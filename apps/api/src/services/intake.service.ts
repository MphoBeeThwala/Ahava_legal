// Client intake: encrypted submissions, de-identified AI triage, and the
// matter (case) each assessed intake becomes.

import { and, count, desc, eq, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import type {
  IntakeSummary,
  MatterCase,
  MatterCaseSummary,
  PublicSubmission,
  StrategyAssessment,
} from '@ahava88/shared';
import { db } from '../db/client';
import { afterCommit, currentFirm } from '../db/tenant-context';
import { setPrincipal, withTenant } from '../db/tenant';
import { reportError } from '../lib/monitoring';
import { firmContainer, objectStore } from './object-store';
import { nextValue } from '../db/sequences';
import {
  assessments,
  caseMembers,
  cases,
  documents,
  submissions,
  type AssessmentRow,
  type CaseRow,
  type SubmissionRow,
} from '../db/schema';
import { getFirmBrand } from '../config/brand';
import { HttpError, httpError } from '../lib/http';
import { SYSTEM_ACTOR, type Actor } from '../lib/actor';
import { iso } from '../lib/time';
import { intakeSubmissionSchema, parse, type IntakeSubmission } from '../validation/schemas';
import { aiConfigured } from '../lib/ai-client';
import { ensureStringArray, triage, type TriageInput } from './ai.service';
import { assessStrategy, detectPracticeArea } from './legal-strategy';
import { deidentify, type KnownPerson } from './deidentify';
import { blindIndex, blindIndexCandidates, decryptJson, encryptJson } from './privacy.service';
import * as auditService from './audit.service';
import { unseal } from './sealed-text';
import * as partyService from './party.service';

/** The client as triage knows them: their name and contact details are removed. */
function intakePeople(submission: IntakeSubmission): KnownPerson[] {
  return [
    {
      role: 'client',
      name: submission.fullName,
      identifiers: [submission.email, submission.phone],
    },
  ];
}

function triageInput(submission: IntakeSubmission): TriageInput {
  return {
    practiceArea: submission.practiceArea,
    jurisdiction: submission.jurisdiction,
    urgencyHint: submission.urgencyHint,
    matterSummary: submission.matterSummary,
    requestedOutcome: submission.requestedOutcome,
    documentsMentioned: submission.documentsMentioned,
    chargeSheet: submission.chargeSheet,
    people: intakePeople(submission),
    consentToAi: submission.consentToAi,
  };
}

export async function nextCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await nextValue(`case_number:${year}`);
  return `${getFirmBrand(currentFirm()).casePrefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

async function nextClientLabel(): Promise<string> {
  const sequence = await nextValue('client_label');
  return `Client ${String(sequence).padStart(3, '0')}`;
}

function toCaseSummary(row: CaseRow): MatterCaseSummary {
  return {
    id: row.id,
    submissionId: row.intakeSubmissionId,
    caseNumber: row.caseNumber,
    status: row.status,
    urgency: row.urgency,
    practiceArea: row.practiceArea,
    nextAction: row.nextAction,
    createdAt: iso(row.createdAt),
  };
}

/** A matter's title: encrypted, or the legacy clear text. */
export async function matterTitle(
  row: Pick<CaseRow, 'title' | 'titleEncrypted'>,
): Promise<string | null> {
  const { title } = await unseal(row.titleEncrypted, { title: row.title ?? '' });
  return title || null;
}

export async function toMatterCase(row: CaseRow): Promise<MatterCase> {
  return {
    id: row.id,
    submissionId: row.intakeSubmissionId,
    caseNumber: row.caseNumber,
    title: await matterTitle(row),
    clientLabel: row.clientLabel,
    practiceArea: row.practiceArea,
    urgency: row.urgency,
    status: row.status,
    nextAction: row.nextAction,
    access: row.access as MatterCase['access'],
    courtDivision: row.courtDivision,
    courtCaseNumber: row.courtCaseNumber,
    courtOnlineReference: row.courtOnlineReference,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function toPublicSubmission(
  submission: SubmissionRow,
  assessment: AssessmentRow | null = null,
  caseRecord: CaseRow | null = null,
): Promise<PublicSubmission> {
  const strategy = assessment?.strategyEncrypted
    ? await decryptJson<StrategyAssessment>(assessment.strategyEncrypted)
    : null;
  return {
    assessmentJob: assessmentJob(submission),
    id: submission.id,
    clientLabel: submission.clientLabel,
    practiceArea: submission.practiceArea,
    jurisdiction: submission.jurisdiction,
    urgencyHint: submission.urgencyHint,
    status: submission.status,
    summary: submission.summaryRedacted,
    createdAt: iso(submission.createdAt),
    assessment: assessment && {
      id: assessment.id,
      matterType: assessment.matterType,
      urgency: assessment.urgency,
      summary: assessment.summary,
      keyFacts: ensureStringArray(assessment.keyFacts),
      attorneyQuestions: ensureStringArray(assessment.attorneyQuestions),
      recommendedDocuments: ensureStringArray(assessment.recommendedDocuments),
      complianceFlags: ensureStringArray(assessment.complianceFlags),
      nextActions: ensureStringArray(assessment.nextActions),
      confidence: assessment.confidence,
      model: assessment.modelName,
      provider: assessment.provider,
      popiaNotes: ensureStringArray(assessment.popiaNotes),
      createdAt: iso(assessment.createdAt),
      strategy,
    },
    matterCase: caseRecord && toCaseSummary(caseRecord),
  };
}

/** Submissions joined with their assessment and case, newest first. */
async function selectSubmissions(where?: SQL, limit = 100) {
  return db()
    .select({ submission: submissions, assessment: assessments, matterCase: cases })
    .from(submissions)
    .leftJoin(assessments, eq(assessments.intakeSubmissionId, submissions.id))
    .leftJoin(cases, eq(cases.intakeSubmissionId, submissions.id))
    .where(where)
    .orderBy(desc(submissions.createdAt))
    .limit(limit);
}

/** Practice area and matter summary, normalised so retyping or spacing does not matter. */
function summaryKey(practiceArea: string, matterSummary: string): string {
  const words = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  return `intake-summary:${words(practiceArea)}|${words(matterSummary)}`;
}

/** How far back an identical intake counts as a duplicate. */
const DUPLICATE_WINDOW_DAYS = 90;
/** How far back the same client in the same practice area counts as a likely duplicate. */
const SAME_CLIENT_WINDOW_HOURS = 24;

/**
 * Refuses (409) an intake that looks like one already on record: the same
 * client (by email) with the same practice area and summary in the last 90
 * days, or the same client and practice area in the last 24 hours. The
 * answer names the existing intake by its numbers only; the client can
 * resend with allowDuplicate to take it anyway.
 */
async function refuseDuplicate(
  email: string,
  summaryLookup: string,
  practiceArea: string,
): Promise<void> {
  const emails = await blindIndexCandidates(email);
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000);
  const recent = new Date(Date.now() - SAME_CLIENT_WINDOW_HOURS * 3_600_000);
  const [match] = await db()
    .select({
      id: submissions.id,
      clientLabel: submissions.clientLabel,
      createdAt: submissions.createdAt,
      summaryLookup: submissions.summaryLookup,
      caseNumber: cases.caseNumber,
    })
    .from(submissions)
    .leftJoin(cases, eq(cases.id, submissions.caseId))
    .where(
      and(
        inArray(submissions.emailLookup, emails),
        or(
          and(
            eq(submissions.summaryLookup, summaryLookup),
            sql`${submissions.createdAt} > ${since}`,
          ),
          and(
            eq(submissions.practiceArea, practiceArea),
            sql`${submissions.createdAt} > ${recent}`,
          ),
        ),
      ),
    )
    .orderBy(desc(submissions.createdAt))
    .limit(1);
  if (!match) {
    return;
  }
  const same = match.summaryLookup === summaryLookup;
  throw httpError(
    same
      ? `This intake is already on record (${match.clientLabel}${match.caseNumber ? `, ${match.caseNumber}` : ''}). Open that one instead of taking it again.`
      : `This client already has a ${practiceArea} intake from the last ${SAME_CLIENT_WINDOW_HOURS} hours (${match.clientLabel}${match.caseNumber ? `, ${match.caseNumber}` : ''}). Is this the same matter?`,
    409,
    {
      duplicate: {
        submissionId: match.id,
        clientLabel: match.clientLabel,
        caseNumber: match.caseNumber ?? null,
        createdAt: iso(match.createdAt),
        identical: same,
      },
    },
  );
}

export async function createSubmission(
  input: unknown,
  actor: Actor = {},
): Promise<PublicSubmission> {
  const { allowDuplicate, ...submission } = parse(intakeSubmissionSchema, input);
  const summaryLookup = await blindIndex(
    summaryKey(submission.practiceArea, submission.matterSummary),
  );
  if (!allowDuplicate) {
    await refuseDuplicate(submission.email, summaryLookup, submission.practiceArea);
  }
  const summary = deidentify(submission.matterSummary, intakePeople(submission));

  const [saved] = await db()
    .insert(submissions)
    .values({
      clientLabel: await nextClientLabel(),
      practiceArea: submission.practiceArea,
      jurisdiction: submission.jurisdiction,
      urgencyHint: submission.urgencyHint,
      status: 'received',
      summaryRedacted: summary.text,
      rawPayloadEncrypted: await encryptJson(submission),
      emailLookup: await blindIndex(submission.email),
      summaryLookup,
      consentToAi: submission.consentToAi,
      consentToStorage: submission.consentToStorage,
    })
    .returning();
  if (!saved) {
    throw new Error('Submission was not stored');
  }

  // The person goes into the register as a prospective client (or is
  // matched to an existing party), so client search and conflict checks
  // find them.
  const partyId = await partyService.partyForIntake(
    { name: submission.fullName, email: submission.email, phone: submission.phone },
    actor,
  );
  await db().update(submissions).set({ partyId }).where(eq(submissions.id, saved.id));

  await auditService.logEventSafely(
    {
      entityType: 'submission',
      entityId: saved.id,
      action: 'submission_created',
      summary: `Intake submitted: ${saved.clientLabel}`,
    },
    // Audit rows are not encrypted, so they never carry the client's identity.
    { fullName: saved.clientLabel, role: 'client' },
  );
  return toPublicSubmission(saved);
}

export async function listSubmissions(limit = 100): Promise<PublicSubmission[]> {
  const rows = await selectSubmissions(undefined, limit);
  return Promise.all(
    rows.map((row) => toPublicSubmission(row.submission, row.assessment, row.matterCase)),
  );
}

/** A background assessment still "running" after this long has died (restart or hang). */
export const ASSESSMENT_STALE_MS = 10 * 60_000;

function assessmentJob(submission: SubmissionRow): PublicSubmission['assessmentJob'] {
  if (!submission.assessmentState || !submission.assessmentStartedAt) {
    return null;
  }
  const startedAt = iso(submission.assessmentStartedAt);
  if (submission.assessmentState === 'running') {
    return Date.now() - submission.assessmentStartedAt.getTime() > ASSESSMENT_STALE_MS
      ? {
          state: 'failed',
          error: 'The assessment stopped before it finished. Please run it again.',
          startedAt,
        }
      : { state: 'running', error: null, startedAt };
  }
  return { state: 'failed', error: submission.assessmentError, startedAt };
}

/** Error text safe to store and show: our own messages only, never driver or provider detail. */
function jobError(error: unknown): string {
  return error instanceof HttpError
    ? error.message.slice(0, 300)
    : 'The assessment failed unexpectedly. Please try again.';
}

/**
 * Starts the assessment in the background and answers at once (the AI calls
 * take one to three minutes: longer than a browser or proxy should wait).
 * The job runs after this request commits, in its own tenant transaction as
 * the same user; the client polls getSubmission() for the result. A job
 * already running is not started twice.
 */
export async function startAssessment(
  id: string,
  actor: Actor = {},
  options: { force?: boolean } = {},
): Promise<PublicSubmission> {
  const [existing] = await selectSubmissions(eq(submissions.id, id), 1);
  if (!existing) {
    throw httpError('Intake submission not found', 404);
  }
  if (
    assessmentJob(existing.submission)?.state === 'running' ||
    (!options.force && alreadyAssessed(existing.assessment))
  ) {
    return toPublicSubmission(existing.submission, existing.assessment, existing.matterCase);
  }
  const [marked] = await db()
    .update(submissions)
    .set({
      assessmentState: 'running',
      assessmentError: null,
      assessmentStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, id))
    .returning();

  const firm = currentFirm();
  const principal =
    actor.userId && actor.role ? { id: actor.userId, role: String(actor.role) } : null;
  const asUser = async <T>(fn: () => Promise<T>) =>
    withTenant(firm, async () => {
      if (principal) await setPrincipal(principal);
      return fn();
    });
  afterCommit(async () => {
    // Not awaited: the response must not wait for the AI.
    void asUser(() => assessSubmission(id, actor, options)).catch(async (error: unknown) => {
      if (!(error instanceof HttpError)) {
        reportError(error, { path: 'intake.assess.background' });
      }
      await asUser(() =>
        db()
          .update(submissions)
          .set({
            assessmentState: 'failed',
            assessmentError: jobError(error),
            updatedAt: new Date(),
          })
          .where(eq(submissions.id, id)),
      ).catch((stored: unknown) => reportError(stored, { path: 'intake.assess.background' }));
    });
  });
  return toPublicSubmission(marked!, existing.assessment, existing.matterCase);
}

export async function getSubmission(id: string): Promise<PublicSubmission | null> {
  const [row] = await selectSubmissions(eq(submissions.id, id), 1);
  return row ? toPublicSubmission(row.submission, row.assessment, row.matterCase) : null;
}

export interface PrivateSubmission {
  submission: SubmissionRow;
  raw: IntakeSubmission | null;
  assessment: AssessmentRow | null;
  caseRecord: CaseRow | null;
}

/** Includes the decrypted personal information: admin/compliance use only. */
export async function getPrivateSubmission(id: string): Promise<PrivateSubmission | null> {
  const [row] = await selectSubmissions(eq(submissions.id, id), 1);
  if (!row) {
    return null;
  }
  return {
    submission: row.submission,
    raw: await decryptJson<IntakeSubmission>(row.submission.rawPayloadEncrypted),
    assessment: row.assessment,
    caseRecord: row.matterCase,
  };
}

/** Finds a data subject's submissions through the email blind index. */
export async function findSubmissionsByEmail(email: string): Promise<PublicSubmission[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  const rows = await selectSubmissions(
    inArray(submissions.emailLookup, await blindIndexCandidates(normalized)),
    1_000,
  );
  return Promise.all(
    rows.map((row) => toPublicSubmission(row.submission, row.assessment, row.matterCase)),
  );
}

/**
 * Assesses an intake and opens (or refreshes) its matter. The user who opens
 * the matter becomes its lead (matter access, see matter-access.service.ts).
 */
/** true when the intake already has an AI assessment (its text never changes after intake). */
function alreadyAssessed(assessment: AssessmentRow | null): boolean {
  return Boolean(assessment && assessment.provider !== 'none');
}

export async function assessSubmission(
  id: string,
  actor: Actor = {},
  options: { force?: boolean } = {},
): Promise<PublicSubmission> {
  const [existing] = await selectSubmissions(eq(submissions.id, id), 1);
  if (!existing) {
    throw httpError('Intake submission not found', 404);
  }
  // Nothing in the intake has changed since it was assessed: answer with the
  // assessment on record rather than paying for the same AI calls again.
  if (!options.force && alreadyAssessed(existing.assessment)) {
    return toPublicSubmission(existing.submission, existing.assessment, existing.matterCase);
  }

  const raw = await decryptJson<IntakeSubmission>(existing.submission.rawPayloadEncrypted);
  if (!raw) {
    throw httpError('Intake submission could not be decrypted', 500);
  }
  // A failed AI call is an error (the user can retry); nothing is saved.
  const { assessment: result, brief } = await triage(triageInput(raw), {
    subjectType: 'submission',
    subjectId: id,
    actor,
  });
  // Matters in a supported practice area also get the strategy assessment
  // (same de-identified brief; only with consent and a configured model).
  const detection = detectPracticeArea({
    practiceArea: raw.practiceArea,
    triageMatterType: result.matterType,
    matterSummary: raw.matterSummary,
    requestedOutcome: raw.requestedOutcome,
    documentsMentioned: raw.documentsMentioned,
    chargeSheet: raw.chargeSheet,
  });
  const strategy =
    raw.consentToAi !== false && aiConfigured() && detection.primary
      ? await assessStrategy(
          brief.text,
          { primary: detection.primary, secondary: detection.secondary },
          { subjectType: 'submission', subjectId: id, actor },
        )
      : null;
  const strategyEncrypted = strategy ? await encryptJson(strategy) : null;
  const nextAction =
    strategy?.winningStrategyRoadmap.immediateActions_0_to_72h[0] ||
    result.nextActions?.[0] ||
    'Attorney to review the intake and confirm next steps.';
  const caseNumber = existing.matterCase ? null : await nextCaseNumber();

  const { submission, assessment, matterCase, created } = await db().transaction(async (tx) => {
    const assessmentValues = {
      intakeSubmissionId: id,
      provider: result.provider,
      modelName: result.model,
      matterType: result.matterType,
      urgency: result.urgency,
      summary: result.summary,
      keyFacts: ensureStringArray(result.keyFacts),
      attorneyQuestions: ensureStringArray(result.attorneyQuestions),
      recommendedDocuments: ensureStringArray(result.recommendedDocuments),
      complianceFlags: ensureStringArray(result.complianceFlags),
      nextActions: ensureStringArray(result.nextActions),
      confidence: Number.isFinite(result.confidence) ? result.confidence : 0,
      popiaNotes: ensureStringArray(result.popiaNotes),
      rawRedactedBrief: brief as unknown as Record<string, unknown>,
      strategyEncrypted,
    };
    const [savedAssessment] = await tx
      .insert(assessments)
      .values(assessmentValues)
      .onConflictDoUpdate({
        target: assessments.intakeSubmissionId,
        set: { ...assessmentValues, createdAt: new Date() },
      })
      .returning();

    let savedCase: CaseRow | undefined;
    let isNew = false;
    if (existing.matterCase) {
      // Re-assessment refreshes the triage; the case keeps its number,
      // status and history.
      [savedCase] = await tx
        .update(cases)
        .set({
          urgency: result.urgency,
          practiceArea: result.matterType || existing.submission.practiceArea,
          nextAction,
          updatedAt: new Date(),
        })
        .where(eq(cases.id, existing.matterCase.id))
        .returning();
    } else {
      isNew = true;
      [savedCase] = await tx
        .insert(cases)
        .values({
          intakeSubmissionId: id,
          caseNumber: caseNumber as string,
          clientLabel: existing.submission.clientLabel,
          practiceArea: result.matterType || existing.submission.practiceArea,
          urgency: result.urgency,
          status: result.urgency === 'critical' ? 'priority-review' : 'triage',
          nextAction,
        })
        .returning();
      if (savedCase && actor.userId) {
        await tx
          .insert(caseMembers)
          .values({
            caseId: savedCase.id,
            userId: actor.userId,
            memberRole: 'lead',
            addedBy: actor.userId,
          })
          .onConflictDoNothing();
      }
    }

    const [savedSubmission] = await tx
      .update(submissions)
      .set({
        status: 'assessed',
        caseId: savedCase?.id ?? null,
        assessmentState: null,
        assessmentError: null,
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id))
      .returning();

    if (!savedAssessment || !savedCase || !savedSubmission) {
      throw new Error('Assessment could not be stored');
    }
    return {
      submission: savedSubmission,
      assessment: savedAssessment,
      matterCase: savedCase,
      created: isNew,
    };
  });

  if (created) {
    await auditService.logEventSafely(
      {
        entityType: 'case',
        entityId: matterCase.id,
        action: 'case_created',
        summary: `Case created: ${matterCase.caseNumber}`,
        details: { submissionId: id, urgency: matterCase.urgency },
      },
      { ...SYSTEM_ACTOR, fullName: 'Intake pipeline' },
    );
  }
  await auditService.logEventSafely(
    {
      entityType: 'submission',
      entityId: id,
      action: 'submission_assessed',
      summary: `Intake assessed: ${submission.clientLabel}`,
      details: { provider: assessment.provider, urgency: matterCase.urgency },
    },
    { ...SYSTEM_ACTOR, fullName: 'Assessment pipeline' },
  );

  return toPublicSubmission(submission, assessment, matterCase);
}

export async function listCases(limit = 500): Promise<MatterCase[]> {
  const rows = await db().select().from(cases).orderBy(desc(cases.createdAt)).limit(limit);
  return Promise.all(rows.map(toMatterCase));
}

/** Finds a case by its id, case number, or intake submission id. */
export async function findCaseByRef(ref: string): Promise<CaseRow | null> {
  const value = ref.trim();
  if (!value) {
    return null;
  }
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const [row] = await db()
    .select()
    .from(cases)
    .where(
      isUuid
        ? or(eq(cases.id, value), eq(cases.intakeSubmissionId, value), eq(cases.caseNumber, value))
        : eq(cases.caseNumber, value),
    )
    .limit(1);
  return row ?? null;
}

export async function getSummary(): Promise<IntakeSummary> {
  const [submissionCounts] = await db()
    .select({
      open: sql<number>`count(*) filter (where ${submissions.status} = 'received')::int`,
    })
    .from(submissions);
  const [assessmentCount] = await db().select({ value: count() }).from(assessments);
  const [caseCounts] = await db()
    .select({
      live: sql<number>`count(*)::int`,
      critical: sql<number>`count(*) filter (where ${cases.urgency} = 'critical')::int`,
    })
    .from(cases);
  const [latest] = await selectSubmissions(undefined, 1);

  return {
    openIntakes: submissionCounts?.open ?? 0,
    assessedIntakes: assessmentCount?.value ?? 0,
    liveCases: caseCounts?.live ?? 0,
    criticalMatters: caseCounts?.critical ?? 0,
    encryptedStorage: true,
    popiaCompliantAi: true,
    latestIntake: latest
      ? await toPublicSubmission(latest.submission, latest.assessment, latest.matterCase)
      : null,
  };
}

/**
 * Permanently deletes submissions and everything that hangs off them
 * (assessment, case, tasks, timeline, documents, billing, calendar) via
 * ON DELETE CASCADE. Returns the ids of the cases removed.
 */
export async function deleteSubmissions(submissionIds: string[]): Promise<string[]> {
  if (!submissionIds.length) {
    return [];
  }
  const removedCases = await db()
    .select({ id: cases.id })
    .from(cases)
    .where(inArray(cases.intakeSubmissionId, submissionIds));
  return deleteRecords(
    submissionIds,
    removedCases.map((row) => row.id),
  );
}

/**
 * Permanently deletes matters (and their intakes, if any) with everything
 * attached to them. Returns the ids of the cases removed.
 */
export async function deleteMatters(rows: Pick<CaseRow, 'id' | 'intakeSubmissionId'>[]) {
  return deleteRecords(
    rows.map((row) => row.intakeSubmissionId).filter((id): id is string => Boolean(id)),
    rows.map((row) => row.id),
  );
}

async function deleteRecords(submissionIds: string[], caseIds: string[]): Promise<string[]> {
  const stored = caseIds.length
    ? await db()
        .select({ firmId: documents.firmId, storageKey: documents.storageKey })
        .from(documents)
        .where(and(inArray(documents.caseId, caseIds), isNotNull(documents.storageKey)))
    : [];
  if (caseIds.length) {
    await db().delete(cases).where(inArray(cases.id, caseIds));
  }
  if (submissionIds.length) {
    const linked = await db()
      .select({ partyId: submissions.partyId })
      .from(submissions)
      .where(and(inArray(submissions.id, submissionIds), isNotNull(submissions.partyId)));
    await db().delete(submissions).where(inArray(submissions.id, submissionIds));
    // Prospective clients that only existed because of these intakes go too.
    await partyService.removeOrphanedProspects(
      linked.map((row) => row.partyId).filter((id): id is string => Boolean(id)),
    );
  }
  // Document bodies in the object store go once the deletion has committed.
  if (stored.length) {
    afterCommit(async () => {
      const store = objectStore();
      for (const item of stored) {
        await store?.delete(firmContainer(item.firmId), item.storageKey!);
      }
    });
  }
  return caseIds;
}
