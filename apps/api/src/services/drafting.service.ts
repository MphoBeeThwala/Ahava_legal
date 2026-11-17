// Drafting from the standard templates (roadmap 15a).
//
// A draft belongs to a matter (matter access applies). Its values are
// encrypted: they name clients and parties. Checks run on every read and
// save. Status: draft -> review (submitted by whoever drafted it) -> final
// (an attorney with drafting.approve finalises it, only with no "must fix"
// issues left; this saves the document to the matter). Audit rows carry the
// matter number and template only.
import type { Draft, DraftIssue, DraftingCatalogue } from '@ahava88/shared';
import { DRAFTING_CATALOGUE, DRAFTING_CATEGORIES } from '@ahava88/shared';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { currentFirm } from '../db/tenant-context';
import { caseParties, documentDrafts, submissions, type CaseRow } from '../db/schema';
import { httpError } from '../lib/http';
import type { Actor } from '../lib/actor';
import { iso, isoOrNull } from '../lib/time';
import { parse, uuidSchema } from '../validation/schemas';
import { findTemplate, summary, TEMPLATES } from '../drafting/registry';
import { longDate } from '../drafting/days';
import { fieldIssues } from '../drafting/fields';
import { renderDocx, renderPdf, renderText } from '../drafting/model';
import type { DraftContext, DraftTemplate } from '../drafting/template';
import { billingSettings, profileSettings } from './firm-settings.service';
import { findCaseByRef } from './intake.service';
import { decryptJson, encryptJson } from './privacy.service';
import * as auditService from './audit.service';
import * as documentsService from './documents.service';
import * as partyService from './party.service';
import type { IntakeSubmission } from '../validation/schemas';

const valuesSchema = z.object({
  values: z.record(z.string().max(80), z.string().max(20_000)),
});
const createSchema = z.object({ templateId: z.string().trim().min(1).max(80) });

type DraftRow = typeof documentDrafts.$inferSelect;

export function catalogue(): DraftingCatalogue {
  return {
    categories: DRAFTING_CATEGORIES,
    kinds: [...DRAFTING_CATALOGUE],
    templates: TEMPLATES.map(summary),
  };
}

async function requireMatter(caseRef: string): Promise<CaseRow> {
  const row = await findCaseByRef(caseRef);
  if (!row) throw httpError('Matter not found', 404);
  return row;
}

function context(matter: CaseRow): DraftContext {
  const firm = currentFirm();
  const profile = profileSettings(firm);
  return {
    today: new Date().toISOString().slice(0, 10),
    caseNumber: matter.caseNumber,
    firm: {
      legalName: firm.tradingName || firm.legalName,
      address: billingSettings(firm).address,
      email: profile.email,
      phone: profile.phone,
    },
  };
}

/** The matter's client, from the register or else the intake. */
async function clientOf(matter: CaseRow) {
  const [link] = await db()
    .select({ partyId: caseParties.partyId })
    .from(caseParties)
    .where(and(eq(caseParties.caseId, matter.id), eq(caseParties.role, 'client')))
    .limit(1);
  if (link) {
    const party = await partyService.getParty(link.partyId);
    return {
      name: party.details.name,
      idNumber: party.details.idNumber ?? party.details.registrationNumber ?? '',
      email: party.details.email ?? '',
      phone: party.details.phone ?? '',
      address: party.details.address ?? '',
    };
  }
  if (matter.intakeSubmissionId) {
    const [row] = await db()
      .select({ raw: submissions.rawPayloadEncrypted })
      .from(submissions)
      .where(eq(submissions.id, matter.intakeSubmissionId));
    const intake = row ? await decryptJson<IntakeSubmission>(row.raw) : null;
    if (intake) {
      return {
        name: intake.fullName,
        idNumber: '',
        email: intake.email,
        phone: intake.phone,
        address: '',
      };
    }
  }
  return { name: '', idNumber: '', email: '', phone: '', address: '' };
}

async function prefill(template: DraftTemplate, matter: CaseRow, ctx: DraftContext) {
  const client = await clientOf(matter);
  const sources: Record<string, string> = {
    'client.name': client.name,
    'client.idNumber': client.idNumber,
    'client.email': client.email,
    'client.phone': client.phone,
    'client.address': client.address,
    'matter.caseNumber': matter.caseNumber,
    'matter.title': matter.title ?? '',
    'firm.legalName': ctx.firm.legalName,
    'firm.address': ctx.firm.address,
    'firm.email': ctx.firm.email,
    'firm.phone': ctx.firm.phone,
    today: ctx.today,
  };
  const values: Record<string, string> = { ...(template.defaults ?? {}) };
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.prefill && sources[field.prefill]) values[field.key] = sources[field.prefill]!;
    }
  }
  return values;
}

/** Who approved the standard wording, and who answers for this document. */
export function reviewNote(template: DraftTemplate): DraftIssue {
  const { review } = template;
  if (review.status === 'reviewed') {
    return {
      severity: 'note',
      message: `Standard wording approved by ${review.by ?? 'the reviewing attorney'}${review.on ? ` on ${longDate(review.on)}` : ''}. The attorney drafting this document remains responsible for checking its grammar, its wording and every input against this matter before it is finalised.`,
    };
  }
  return {
    severity: 'note',
    message:
      'The standard wording of this template has not yet been reviewed by an admitted attorney: read the whole document before it is finalised.',
  };
}

export function checkDraft(
  template: DraftTemplate,
  values: Record<string, string>,
  ctx: DraftContext,
): DraftIssue[] {
  const fields = template.sections.flatMap((section) => section.fields);
  const order = { must: 0, should: 1, note: 2 };
  const issues = [...fieldIssues(fields, values), ...template.checks(values, ctx)];
  issues.push(reviewNote(template));
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

async function toDraft(row: DraftRow, matter: CaseRow): Promise<Draft> {
  const template = findTemplate(row.templateId);
  if (!template) throw httpError('This draft’s template is no longer available', 409);
  const values = (await decryptJson<Record<string, string>>(row.valuesEncrypted)) ?? {};
  const ctx = context(matter);
  return {
    id: row.id,
    caseNumber: matter.caseNumber,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    title: template.name,
    status: row.status as Draft['status'],
    values,
    issues: checkDraft(template, values, ctx),
    preview: renderText(template.build(values, ctx), template.format),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    createdBy: row.createdBy,
    submittedAt: isoOrNull(row.submittedAt),
    finalisedAt: isoOrNull(row.finalisedAt),
    finalisedBy: row.finalisedBy,
    documentId: row.documentId,
  };
}

async function requireDraft(caseRef: string, draftId: string) {
  const matter = await requireMatter(caseRef);
  const [row] = await db()
    .select()
    .from(documentDrafts)
    .where(
      and(eq(documentDrafts.id, parse(uuidSchema, draftId)), eq(documentDrafts.caseId, matter.id)),
    );
  if (!row) throw httpError('Draft not found', 404);
  return { matter, row };
}

const audit = (
  draftId: string,
  action: string,
  matter: CaseRow,
  templateId: string,
  actor: Actor,
) =>
  auditService.logEvent(
    {
      entityType: 'document_draft',
      entityId: draftId,
      action,
      summary: `Draft (${templateId}) ${action.replace('draft_', '')} on ${matter.caseNumber}`,
      details: { caseId: matter.id, templateId },
    },
    actor,
  );

export async function listDrafts(caseRef: string): Promise<Draft[]> {
  const matter = await requireMatter(caseRef);
  const rows = await db()
    .select()
    .from(documentDrafts)
    .where(eq(documentDrafts.caseId, matter.id))
    .orderBy(desc(documentDrafts.createdAt));
  return Promise.all(
    rows.filter((row) => findTemplate(row.templateId)).map((row) => toDraft(row, matter)),
  );
}

export async function createDraft(caseRef: string, input: unknown, actor: Actor): Promise<Draft> {
  const { templateId } = parse(createSchema, input);
  const template = findTemplate(templateId);
  if (!template) throw httpError('No standard template for that document yet', 404);
  const matter = await requireMatter(caseRef);
  const values = await prefill(template, matter, context(matter));
  const [row] = await db()
    .insert(documentDrafts)
    .values({
      caseId: matter.id,
      templateId: template.id,
      templateVersion: template.version,
      valuesEncrypted: await encryptJson(values),
      createdBy: actor.userId ?? null,
    })
    .returning();
  if (!row) throw new Error('Draft was not stored');
  await audit(row.id, 'draft_created', matter, template.id, actor);
  return toDraft(row, matter);
}

export async function getDraft(caseRef: string, draftId: string): Promise<Draft> {
  const { matter, row } = await requireDraft(caseRef, draftId);
  return toDraft(row, matter);
}

export async function updateDraft(
  caseRef: string,
  draftId: string,
  input: unknown,
  actor: Actor,
): Promise<Draft> {
  const { values } = parse(valuesSchema, input);
  const { matter, row } = await requireDraft(caseRef, draftId);
  if (row.status === 'final')
    throw httpError('A final document cannot be changed; start a new draft', 409);
  const template = findTemplate(row.templateId)!;
  const known = new Set(
    template.sections.flatMap((section) => section.fields.map((field) => field.key)),
  );
  const kept = Object.fromEntries(Object.entries(values).filter(([key]) => known.has(key)));
  const [saved] = await db()
    .update(documentDrafts)
    .set({
      valuesEncrypted: await encryptJson(kept),
      // Changing a draft under review sends it back to draft.
      status: 'draft',
      submittedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(documentDrafts.id, row.id))
    .returning();
  await audit(row.id, 'draft_updated', matter, row.templateId, actor);
  return toDraft(saved!, matter);
}

export async function submitDraft(caseRef: string, draftId: string, actor: Actor): Promise<Draft> {
  const { matter, row } = await requireDraft(caseRef, draftId);
  if (row.status !== 'draft') throw httpError('Only a draft can be submitted for review', 409);
  const [saved] = await db()
    .update(documentDrafts)
    .set({ status: 'review', submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(documentDrafts.id, row.id))
    .returning();
  await audit(row.id, 'draft_submitted', matter, row.templateId, actor);
  return toDraft(saved!, matter);
}

/** An attorney finalises: no "must fix" issues may remain. Saves the document to the matter. */
/** The finalising attorney confirms they checked the document for this matter. */
const finaliseSchema = z.object({
  checked: z.literal(
    true,
    'Confirm that you have checked the grammar, wording and every input for this matter',
  ),
});

export async function finaliseDraft(
  caseRef: string,
  draftId: string,
  input: unknown,
  actor: Actor,
): Promise<Draft> {
  parse(finaliseSchema, input ?? {});
  const { matter, row } = await requireDraft(caseRef, draftId);
  if (row.status !== 'review')
    throw httpError('Submit the draft for review before finalising it', 409);
  const draft = await toDraft(row, matter);
  const blocking = draft.issues.filter((issue) => issue.severity === 'must');
  if (blocking.length) {
    throw httpError(`Fix these first: ${blocking.map((issue) => issue.message).join(' ')}`, 422);
  }
  const document = await documentsService.createDocument(
    {
      caseId: matter.id,
      title: draft.title,
      body: draft.preview,
      documentType: 'drafted',
      status: 'final',
      tags: ['drafted', row.templateId],
      metadata: {
        draftId: row.id,
        templateId: row.templateId,
        templateVersion: row.templateVersion,
      },
    },
    actor,
  );
  const [saved] = await db()
    .update(documentDrafts)
    .set({
      status: 'final',
      finalisedAt: new Date(),
      finalisedBy: actor.userId ?? null,
      documentId: document.id,
      updatedAt: new Date(),
    })
    .where(eq(documentDrafts.id, row.id))
    .returning();
  await audit(row.id, 'draft_finalised', matter, row.templateId, actor);
  return toDraft(saved!, matter);
}

export async function deleteDraft(caseRef: string, draftId: string, actor: Actor): Promise<void> {
  const { matter, row } = await requireDraft(caseRef, draftId);
  if (row.status === 'final') throw httpError('A final document stays on the matter', 409);
  await db().delete(documentDrafts).where(eq(documentDrafts.id, row.id));
  await audit(row.id, 'draft_deleted', matter, row.templateId, actor);
}

/** The draft as a Word document or PDF (any status: drafts are marked as such in the file name). */
export async function renderDraft(caseRef: string, draftId: string, format: 'docx' | 'pdf') {
  const { matter, row } = await requireDraft(caseRef, draftId);
  const template = findTemplate(row.templateId);
  if (!template) throw httpError('This draft’s template is no longer available', 409);
  const values = (await decryptJson<Record<string, string>>(row.valuesEncrypted)) ?? {};
  const model = template.build(values, context(matter));
  const body =
    format === 'docx'
      ? await renderDocx(model, template.format)
      : await renderPdf(model, template.format);
  const name = `${matter.caseNumber} ${template.name}${row.status === 'final' ? '' : ' (DRAFT)'}`
    .replace(/[^\w ().-]+/g, '')
    .trim();
  return {
    body,
    filename: `${name}.${format}`,
    contentType:
      format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf',
  };
}
