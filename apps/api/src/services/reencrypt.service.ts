// Moves a firm's encrypted data onto its active data key: legacy v1 values
// (global INTAKE_ENCRYPTION_KEY) and values under retired key versions.
// Runs in small batches, each in its own transaction, so it is safe to stop
// and re-run. Blind indexes are recomputed with the firm's index key on the way.
import { and, count, eq, isNotNull, isNull, ne, not, or, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { IntakeSubmission } from '../validation/schemas';
import { db } from '../db/client';
import { withTenant } from '../db/tenant';
import {
  conflictChecks,
  documents,
  ficaDocuments,
  ficaProfiles,
  firmKeys,
  parties,
  submissions,
  timeEntries,
  timers,
  users,
  invoices,
  disbursements,
  calendarEvents,
  matterPrescriptions,
  researchRequests,
  documentDrafts,
  aiCalls,
  firmPrecedents,
  trustAccounts,
  trustEntries,
  trustReconciliations,
  portalUsers,
  portalMessages,
  supportTickets,
  supportTicketMessages,
  cases,
  caseTasks,
  caseTimeline,
  notifications,
  reportSnapshots,
  type FirmRow,
} from '../db/schema';
import { activeKey, deleteKey } from './keys.service';
import { blindIndex, decryptJson, encryptJson } from './privacy.service';
import { readSealedContent, writeSealedContent } from './documents.service';
import { readSealedFica } from './fica.service';
import { firmContainer, objectStore } from './object-store';

const BATCH = 200;

function notOnVersion(column: AnyPgColumn, version: number): SQL {
  return not(sql`${column} like ${`v2:${version}:%`}`);
}

/** Free text sealed with the firm key (sealed-text.ts): each nullable column. */
const SEALED_TEXT = [
  { table: cases, id: cases.id, column: cases.titleEncrypted, key: 'titleEncrypted' },
  {
    table: caseTasks,
    id: caseTasks.id,
    column: caseTasks.contentEncrypted,
    key: 'contentEncrypted',
  },
  {
    table: caseTimeline,
    id: caseTimeline.id,
    column: caseTimeline.contentEncrypted,
    key: 'contentEncrypted',
  },
  { table: documents, id: documents.id, column: documents.metaEncrypted, key: 'metaEncrypted' },
  {
    table: notifications,
    id: notifications.id,
    column: notifications.contentEncrypted,
    key: 'contentEncrypted',
  },
  {
    table: reportSnapshots,
    id: reportSnapshots.id,
    column: reportSnapshots.titleEncrypted,
    key: 'titleEncrypted',
  },
] as const;

async function countSealedText(where: (column: AnyPgColumn) => SQL): Promise<number> {
  let total = 0;
  for (const sealed of SEALED_TEXT) {
    const [row] = await db()
      .select({ value: count() })
      .from(sealed.table)
      .where(and(isNotNull(sealed.column), where(sealed.column)));
    total += row?.value ?? 0;
  }
  return total;
}

async function reencryptSealedText(version: number): Promise<number> {
  let done = 0;
  for (const sealed of SEALED_TEXT) {
    const rows = await db()
      .select({ id: sealed.id, value: sealed.column })
      .from(sealed.table)
      .where(and(isNotNull(sealed.column), notOnVersion(sealed.column, version)))
      .limit(BATCH);
    for (const row of rows) {
      await db()
        .update(sealed.table)
        .set({ [sealed.key]: await encryptJson(await decryptJson(row.value)) } as never)
        .where(eq(sealed.id, row.id));
    }
    done += rows.length;
  }
  return done;
}

function staleSubmissions(version: number): SQL {
  return notOnVersion(submissions.rawPayloadEncrypted, version);
}

function staleDocuments(version: number): SQL {
  return or(
    and(isNotNull(documents.encryptedContent), notOnVersion(documents.encryptedContent, version)),
    and(
      isNotNull(documents.storageKey),
      or(isNull(documents.contentKeyVersion), ne(documents.contentKeyVersion, version)),
    ),
  ) as SQL;
}

function staleParties(version: number): SQL {
  return notOnVersion(parties.detailsEncrypted, version);
}

function staleChecks(version: number): SQL {
  return or(
    notOnVersion(conflictChecks.queryEncrypted, version),
    and(
      isNotNull(conflictChecks.decisionNotesEncrypted),
      notOnVersion(conflictChecks.decisionNotesEncrypted, version),
    ),
  ) as SQL;
}

function staleFicaProfiles(version: number): SQL {
  return and(
    isNotNull(ficaProfiles.notesEncrypted),
    notOnVersion(ficaProfiles.notesEncrypted, version),
  ) as SQL;
}

function staleFicaDocuments(version: number): SQL {
  return or(
    notOnVersion(ficaDocuments.fileNameEncrypted, version),
    and(
      isNotNull(ficaDocuments.encryptedContent),
      notOnVersion(ficaDocuments.encryptedContent, version),
    ),
    and(
      isNotNull(ficaDocuments.storageKey),
      or(isNull(ficaDocuments.contentKeyVersion), ne(ficaDocuments.contentKeyVersion, version)),
    ),
  ) as SQL;
}

function staleTimeEntries(version: number): SQL {
  return notOnVersion(timeEntries.descriptionEncrypted, version);
}

function staleTimers(version: number): SQL {
  return and(
    isNotNull(timers.descriptionEncrypted),
    notOnVersion(timers.descriptionEncrypted, version),
  ) as SQL;
}

function staleInvoices(version: number): SQL {
  return and(
    isNotNull(invoices.contentEncrypted),
    notOnVersion(invoices.contentEncrypted, version),
  ) as SQL;
}

function staleDisbursements(version: number): SQL {
  return notOnVersion(disbursements.descriptionEncrypted, version);
}

function staleEvents(version: number): SQL {
  return and(
    isNotNull(calendarEvents.contentEncrypted),
    notOnVersion(calendarEvents.contentEncrypted, version),
  ) as SQL;
}

function stalePrescriptions(version: number): SQL {
  return and(
    isNotNull(matterPrescriptions.notesEncrypted),
    notOnVersion(matterPrescriptions.notesEncrypted, version),
  ) as SQL;
}

function staleResearch(version: number): SQL {
  return or(
    notOnVersion(researchRequests.questionEncrypted, version),
    notOnVersion(researchRequests.briefEncrypted, version),
    notOnVersion(researchRequests.mappingEncrypted, version),
    and(
      isNotNull(researchRequests.answerEncrypted),
      notOnVersion(researchRequests.answerEncrypted, version),
    ),
    and(
      isNotNull(researchRequests.sourcesEncrypted),
      notOnVersion(researchRequests.sourcesEncrypted, version),
    ),
    and(
      isNotNull(researchRequests.approvalNoteEncrypted),
      notOnVersion(researchRequests.approvalNoteEncrypted, version),
    ),
  ) as SQL;
}

function staleTrustEntries(version: number): SQL {
  return or(
    notOnVersion(trustEntries.referenceEncrypted, version),
    notOnVersion(trustEntries.descriptionEncrypted, version),
  ) as SQL;
}

function stalePortalUsers(version: number): SQL {
  return or(
    notOnVersion(portalUsers.emailEncrypted, version),
    and(
      isNotNull(portalUsers.totpSecretEncrypted),
      notOnVersion(portalUsers.totpSecretEncrypted, version),
    ),
  ) as SQL;
}

function staleClientUpdates(version: number): SQL {
  return and(
    isNotNull(cases.clientUpdateEncrypted),
    notOnVersion(cases.clientUpdateEncrypted, version),
  ) as SQL;
}

function stalePrecedents(version: number): SQL {
  return or(
    notOnVersion(firmPrecedents.originalEncrypted, version),
    notOnVersion(firmPrecedents.reviewEncrypted, version),
  ) as SQL;
}

function staleAiCalls(version: number): SQL {
  return or(
    and(isNotNull(aiCalls.promptEncrypted), notOnVersion(aiCalls.promptEncrypted, version)),
    and(isNotNull(aiCalls.responseEncrypted), notOnVersion(aiCalls.responseEncrypted, version)),
  ) as SQL;
}

function staleUsers(version: number): SQL {
  return and(
    isNotNull(users.mfaSecretEncrypted),
    notOnVersion(users.mfaSecretEncrypted, version),
  ) as SQL;
}

export interface ReencryptCounts {
  submissions: number;
  documents: number;
  users: number;
  parties: number;
  conflictChecks: number;
  fica: number;
  time: number;
  billing: number;
  calendar: number;
  research: number;
  trust: number;
  portal: number;
  support: number;
}

export interface ReencryptStatus {
  activeVersion: number;
  pending: {
    submissions: number;
    documents: number;
    users: number;
    parties: number;
    conflictChecks: number;
    fica: number;
    time: number;
    billing: number;
    calendar: number;
    research: number;
    trust: number;
    portal: number;
    support: number;
  };
}

/** How much of the current firm's data is not yet on the active key. */
export async function pendingReencryption(): Promise<ReencryptStatus> {
  const { version } = await activeKey('data');
  const [[fp], [fd], [te], [tm]] = await Promise.all([
    db().select({ value: count() }).from(ficaProfiles).where(staleFicaProfiles(version)),
    db().select({ value: count() }).from(ficaDocuments).where(staleFicaDocuments(version)),
    db().select({ value: count() }).from(timeEntries).where(staleTimeEntries(version)),
    db().select({ value: count() }).from(timers).where(staleTimers(version)),
  ]);
  const [[bi], [bd]] = await Promise.all([
    db().select({ value: count() }).from(invoices).where(staleInvoices(version)),
    db().select({ value: count() }).from(disbursements).where(staleDisbursements(version)),
  ]);
  const [[ce], [mp]] = await Promise.all([
    db().select({ value: count() }).from(calendarEvents).where(staleEvents(version)),
    db().select({ value: count() }).from(matterPrescriptions).where(stalePrescriptions(version)),
  ]);
  const [[rr], [ac]] = await Promise.all([
    db().select({ value: count() }).from(researchRequests).where(staleResearch(version)),
    db().select({ value: count() }).from(aiCalls).where(staleAiCalls(version)),
  ]);
  const [[pu], [pm], [cu]] = await Promise.all([
    db().select({ value: count() }).from(portalUsers).where(stalePortalUsers(version)),
    db()
      .select({ value: count() })
      .from(portalMessages)
      .where(notOnVersion(portalMessages.bodyEncrypted, version)),
    db().select({ value: count() }).from(cases).where(staleClientUpdates(version)),
  ]);
  const [[st], [sm]] = await Promise.all([
    db()
      .select({ value: count() })
      .from(supportTickets)
      .where(notOnVersion(supportTickets.subjectEncrypted, version)),
    db()
      .select({ value: count() })
      .from(supportTicketMessages)
      .where(notOnVersion(supportTicketMessages.bodyEncrypted, version)),
  ]);
  const [[fpr], [ta], [tre], [tr]] = await Promise.all([
    db().select({ value: count() }).from(firmPrecedents).where(stalePrecedents(version)),
    db()
      .select({ value: count() })
      .from(trustAccounts)
      .where(notOnVersion(trustAccounts.accountNumberEncrypted, version)),
    db().select({ value: count() }).from(trustEntries).where(staleTrustEntries(version)),
    db()
      .select({ value: count() })
      .from(trustReconciliations)
      .where(
        and(
          isNotNull(trustReconciliations.notesEncrypted),
          notOnVersion(trustReconciliations.notesEncrypted, version),
        ),
      ),
  ]);
  const [[s], [d], [u], [p], [c]] = await Promise.all([
    db().select({ value: count() }).from(submissions).where(staleSubmissions(version)),
    db().select({ value: count() }).from(documents).where(staleDocuments(version)),
    db().select({ value: count() }).from(users).where(staleUsers(version)),
    db().select({ value: count() }).from(parties).where(staleParties(version)),
    db().select({ value: count() }).from(conflictChecks).where(staleChecks(version)),
  ]);
  // Drafts (drafting) count with documents.
  const [dr] = await db()
    .select({ value: count() })
    .from(documentDrafts)
    .where(notOnVersion(documentDrafts.valuesEncrypted, version));
  const sealedText = await countSealedText((column) => notOnVersion(column, version));
  return {
    activeVersion: version,
    pending: {
      submissions: s?.value ?? 0,
      documents: (d?.value ?? 0) + (dr?.value ?? 0) + sealedText,
      users: u?.value ?? 0,
      parties: p?.value ?? 0,
      conflictChecks: c?.value ?? 0,
      fica: (fp?.value ?? 0) + (fd?.value ?? 0),
      time: (te?.value ?? 0) + (tm?.value ?? 0),
      billing: (bi?.value ?? 0) + (bd?.value ?? 0),
      calendar: (ce?.value ?? 0) + (mp?.value ?? 0),
      research: (rr?.value ?? 0) + (ac?.value ?? 0) + (fpr?.value ?? 0),
      trust: (ta?.value ?? 0) + (tre?.value ?? 0) + (tr?.value ?? 0),
      portal: (pu?.value ?? 0) + (pm?.value ?? 0) + (cu?.value ?? 0),
      support: (st?.value ?? 0) + (sm?.value ?? 0),
    },
  };
}

async function reencryptBatch(): Promise<ReencryptCounts> {
  const { version } = await activeKey('data');

  const subs = await db().select().from(submissions).where(staleSubmissions(version)).limit(BATCH);
  for (const row of subs) {
    const raw = await decryptJson<IntakeSubmission>(row.rawPayloadEncrypted);
    if (!raw) continue;
    await db()
      .update(submissions)
      .set({
        rawPayloadEncrypted: await encryptJson(raw),
        emailLookup: await blindIndex(raw.email),
      })
      .where(eq(submissions.id, row.id));
  }

  const docs = await db().select().from(documents).where(staleDocuments(version)).limit(BATCH);
  for (const row of docs) {
    const content = await decryptJson(await readSealedContent(row));
    const sealed = await encryptJson(content);
    if (row.storageKey) {
      // Same key: the stored object is replaced with the new ciphertext.
      const location = await writeSealedContent(row.id, sealed);
      await db()
        .update(documents)
        .set({ contentKeyVersion: location.contentKeyVersion ?? version })
        .where(eq(documents.id, row.id));
    } else {
      await db()
        .update(documents)
        .set({ encryptedContent: sealed })
        .where(eq(documents.id, row.id));
    }
  }

  const people = await db().select().from(users).where(staleUsers(version)).limit(BATCH);
  for (const row of people) {
    const secret = await decryptJson<string>(row.mfaSecretEncrypted);
    await db()
      .update(users)
      .set({ mfaSecretEncrypted: await encryptJson(secret) })
      .where(eq(users.id, row.id));
  }

  const partyRows = await db().select().from(parties).where(staleParties(version)).limit(BATCH);
  for (const row of partyRows) {
    const details = await decryptJson(row.detailsEncrypted);
    await db()
      .update(parties)
      .set({ detailsEncrypted: await encryptJson(details) })
      .where(eq(parties.id, row.id));
  }
  // Party blind indexes use the stable index key, so they need no rebuild.

  const checks = await db().select().from(conflictChecks).where(staleChecks(version)).limit(BATCH);
  for (const row of checks) {
    await db()
      .update(conflictChecks)
      .set({
        queryEncrypted: await encryptJson(await decryptJson(row.queryEncrypted)),
        decisionNotesEncrypted: row.decisionNotesEncrypted
          ? await encryptJson(await decryptJson(row.decisionNotesEncrypted))
          : null,
      })
      .where(eq(conflictChecks.id, row.id));
  }

  const profiles = await db()
    .select()
    .from(ficaProfiles)
    .where(staleFicaProfiles(version))
    .limit(BATCH);
  for (const row of profiles) {
    await db()
      .update(ficaProfiles)
      .set({ notesEncrypted: await encryptJson(await decryptJson(row.notesEncrypted)) })
      .where(eq(ficaProfiles.id, row.id));
  }
  const kyc = await db()
    .select()
    .from(ficaDocuments)
    .where(staleFicaDocuments(version))
    .limit(BATCH);
  for (const row of kyc) {
    const sealed = await encryptJson(await decryptJson(await readSealedFica(row)));
    const fileNameEncrypted = await encryptJson(await decryptJson(row.fileNameEncrypted));
    if (row.storageKey) {
      await objectStore()?.put(
        firmContainer(row.firmId),
        row.storageKey,
        Buffer.from(sealed, 'utf8'),
      );
      await db()
        .update(ficaDocuments)
        .set({ fileNameEncrypted, contentKeyVersion: version })
        .where(eq(ficaDocuments.id, row.id));
    } else {
      await db()
        .update(ficaDocuments)
        .set({ fileNameEncrypted, encryptedContent: sealed })
        .where(eq(ficaDocuments.id, row.id));
    }
  }

  const entries = await db()
    .select()
    .from(timeEntries)
    .where(staleTimeEntries(version))
    .limit(BATCH);
  for (const row of entries) {
    await db()
      .update(timeEntries)
      .set({ descriptionEncrypted: await encryptJson(await decryptJson(row.descriptionEncrypted)) })
      .where(eq(timeEntries.id, row.id));
  }
  const running = await db().select().from(timers).where(staleTimers(version)).limit(BATCH);
  for (const row of running) {
    await db()
      .update(timers)
      .set({ descriptionEncrypted: await encryptJson(await decryptJson(row.descriptionEncrypted)) })
      .where(eq(timers.id, row.id));
  }

  const bills = await db().select().from(invoices).where(staleInvoices(version)).limit(BATCH);
  for (const row of bills) {
    await db()
      .update(invoices)
      .set({ contentEncrypted: await encryptJson(await decryptJson(row.contentEncrypted)) })
      .where(eq(invoices.id, row.id));
  }
  const costs = await db()
    .select()
    .from(disbursements)
    .where(staleDisbursements(version))
    .limit(BATCH);
  for (const row of costs) {
    await db()
      .update(disbursements)
      .set({ descriptionEncrypted: await encryptJson(await decryptJson(row.descriptionEncrypted)) })
      .where(eq(disbursements.id, row.id));
  }

  const events = await db().select().from(calendarEvents).where(staleEvents(version)).limit(BATCH);
  for (const row of events) {
    await db()
      .update(calendarEvents)
      .set({ contentEncrypted: await encryptJson(await decryptJson(row.contentEncrypted)) })
      .where(eq(calendarEvents.id, row.id));
  }
  const periods = await db()
    .select()
    .from(matterPrescriptions)
    .where(stalePrescriptions(version))
    .limit(BATCH);
  for (const row of periods) {
    await db()
      .update(matterPrescriptions)
      .set({ notesEncrypted: await encryptJson(await decryptJson(row.notesEncrypted)) })
      .where(eq(matterPrescriptions.id, row.id));
  }

  const drafts = await db()
    .select()
    .from(documentDrafts)
    .where(notOnVersion(documentDrafts.valuesEncrypted, version))
    .limit(BATCH);
  for (const row of drafts) {
    await db()
      .update(documentDrafts)
      .set({ valuesEncrypted: await encryptJson(await decryptJson(row.valuesEncrypted)) })
      .where(eq(documentDrafts.id, row.id));
  }

  const briefs = await db()
    .select()
    .from(researchRequests)
    .where(staleResearch(version))
    .limit(BATCH);
  for (const row of briefs) {
    await db()
      .update(researchRequests)
      .set({
        questionEncrypted: await encryptJson(await decryptJson(row.questionEncrypted)),
        briefEncrypted: await encryptJson(await decryptJson(row.briefEncrypted)),
        mappingEncrypted: await encryptJson(await decryptJson(row.mappingEncrypted)),
        answerEncrypted: row.answerEncrypted
          ? await encryptJson(await decryptJson(row.answerEncrypted))
          : null,
        sourcesEncrypted: row.sourcesEncrypted
          ? await encryptJson(await decryptJson(row.sourcesEncrypted))
          : null,
        approvalNoteEncrypted: row.approvalNoteEncrypted
          ? await encryptJson(await decryptJson(row.approvalNoteEncrypted))
          : null,
      })
      .where(eq(researchRequests.id, row.id));
  }
  const precedentRows = await db()
    .select()
    .from(firmPrecedents)
    .where(stalePrecedents(version))
    .limit(BATCH);
  for (const row of precedentRows) {
    await db()
      .update(firmPrecedents)
      .set({
        originalEncrypted: await encryptJson(await decryptJson(row.originalEncrypted)),
        reviewEncrypted: await encryptJson(await decryptJson(row.reviewEncrypted)),
      })
      .where(eq(firmPrecedents.id, row.id));
  }
  const calls = await db().select().from(aiCalls).where(staleAiCalls(version)).limit(BATCH);
  for (const row of calls) {
    await db()
      .update(aiCalls)
      .set({
        promptEncrypted: row.promptEncrypted
          ? await encryptJson(await decryptJson(row.promptEncrypted))
          : null,
        responseEncrypted: row.responseEncrypted
          ? await encryptJson(await decryptJson(row.responseEncrypted))
          : null,
      })
      .where(eq(aiCalls.id, row.id));
  }

  const trustAccountRows = await db()
    .select()
    .from(trustAccounts)
    .where(notOnVersion(trustAccounts.accountNumberEncrypted, version))
    .limit(BATCH);
  for (const row of trustAccountRows) {
    await db()
      .update(trustAccounts)
      .set({
        accountNumberEncrypted: await encryptJson(await decryptJson(row.accountNumberEncrypted)),
      })
      .where(eq(trustAccounts.id, row.id));
  }
  const trustRows = await db()
    .select()
    .from(trustEntries)
    .where(staleTrustEntries(version))
    .limit(BATCH);
  for (const row of trustRows) {
    // Only the encrypted text is rewritten; amounts and status never change.
    await db()
      .update(trustEntries)
      .set({
        referenceEncrypted: await encryptJson(await decryptJson(row.referenceEncrypted)),
        descriptionEncrypted: await encryptJson(await decryptJson(row.descriptionEncrypted)),
      })
      .where(eq(trustEntries.id, row.id));
  }
  const reconciliationRows = await db()
    .select()
    .from(trustReconciliations)
    .where(
      and(
        isNotNull(trustReconciliations.notesEncrypted),
        notOnVersion(trustReconciliations.notesEncrypted, version),
      ),
    )
    .limit(BATCH);
  for (const row of reconciliationRows) {
    await db()
      .update(trustReconciliations)
      .set({ notesEncrypted: await encryptJson(await decryptJson(row.notesEncrypted!)) })
      .where(eq(trustReconciliations.id, row.id));
  }

  const portalRows = await db()
    .select()
    .from(portalUsers)
    .where(stalePortalUsers(version))
    .limit(BATCH);
  for (const row of portalRows) {
    const email = (await decryptJson<string>(row.emailEncrypted)) ?? '';
    await db()
      .update(portalUsers)
      .set({
        emailEncrypted: await encryptJson(email),
        // The index key may have changed too.
        emailIndex: await blindIndex(email),
        totpSecretEncrypted: row.totpSecretEncrypted
          ? await encryptJson(await decryptJson(row.totpSecretEncrypted))
          : null,
      })
      .where(eq(portalUsers.id, row.id));
  }
  const messageRows = await db()
    .select()
    .from(portalMessages)
    .where(notOnVersion(portalMessages.bodyEncrypted, version))
    .limit(BATCH);
  for (const row of messageRows) {
    await db()
      .update(portalMessages)
      .set({ bodyEncrypted: await encryptJson(await decryptJson(row.bodyEncrypted)) })
      .where(eq(portalMessages.id, row.id));
  }
  const updateRows = await db()
    .select({ id: cases.id, value: cases.clientUpdateEncrypted })
    .from(cases)
    .where(staleClientUpdates(version))
    .limit(BATCH);
  for (const row of updateRows) {
    await db()
      .update(cases)
      .set({ clientUpdateEncrypted: await encryptJson(await decryptJson(row.value!)) })
      .where(eq(cases.id, row.id));
  }
  const ticketRows = await db()
    .select({ id: supportTickets.id, value: supportTickets.subjectEncrypted })
    .from(supportTickets)
    .where(notOnVersion(supportTickets.subjectEncrypted, version))
    .limit(BATCH);
  for (const row of ticketRows) {
    await db()
      .update(supportTickets)
      .set({ subjectEncrypted: await encryptJson(await decryptJson(row.value)) })
      .where(eq(supportTickets.id, row.id));
  }
  const ticketMessageRows = await db()
    .select({ id: supportTicketMessages.id, value: supportTicketMessages.bodyEncrypted })
    .from(supportTicketMessages)
    .where(notOnVersion(supportTicketMessages.bodyEncrypted, version))
    .limit(BATCH);
  for (const row of ticketMessageRows) {
    await db()
      .update(supportTicketMessages)
      .set({ bodyEncrypted: await encryptJson(await decryptJson(row.value)) })
      .where(eq(supportTicketMessages.id, row.id));
  }

  const sealedText = await reencryptSealedText(version);

  return {
    submissions: subs.length,
    documents: docs.length + drafts.length + sealedText,
    users: people.length,
    parties: partyRows.length,
    conflictChecks: checks.length,
    fica: profiles.length + kyc.length,
    time: entries.length + running.length,
    billing: bills.length + costs.length,
    calendar: events.length + periods.length,
    research: briefs.length + calls.length + precedentRows.length,
    trust: trustAccountRows.length + trustRows.length + reconciliationRows.length,
    portal: portalRows.length + messageRows.length + updateRows.length,
    support: ticketRows.length + ticketMessageRows.length,
  };
}

/** Re-encrypts all of a firm's data onto its active key. */
export async function reencryptFirm(firm: FirmRow) {
  const total = {
    submissions: 0,
    documents: 0,
    users: 0,
    parties: 0,
    conflictChecks: 0,
    fica: 0,
    time: 0,
    billing: 0,
    calendar: 0,
    research: 0,
    trust: 0,
    portal: 0,
  };
  for (;;) {
    const done = await withTenant(firm, () => reencryptBatch(), { system: true });
    total.submissions += done.submissions;
    total.documents += done.documents;
    total.users += done.users;
    total.parties += done.parties;
    total.conflictChecks += done.conflictChecks;
    total.fica += done.fica;
    total.time += done.time;
    total.billing += done.billing;
    total.calendar += done.calendar;
    total.research += done.research;
    total.trust += done.trust;
    total.portal += done.portal;
    if (Object.values(done).every((value) => value === 0)) {
      return total;
    }
  }
}

/** Deletes retired data keys that no stored value uses any more. */
export async function pruneRetiredKeys(): Promise<number[]> {
  const retired = await db()
    .select()
    .from(firmKeys)
    .where(and(eq(firmKeys.purpose, 'data'), eq(firmKeys.status, 'retired')));
  const pruned: number[] = [];
  for (const key of retired) {
    const prefix = `v2:${key.version}:%`;
    const [[s], [d], [u]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(submissions)
        .where(sql`${submissions.rawPayloadEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(documents)
        .where(
          or(
            sql`${documents.encryptedContent} like ${prefix}`,
            eq(documents.contentKeyVersion, key.version),
          ),
        ),
      db()
        .select({ value: count() })
        .from(users)
        .where(sql`${users.mfaSecretEncrypted} like ${prefix}`),
    ]);
    const [[p], [c]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(parties)
        .where(sql`${parties.detailsEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(conflictChecks)
        .where(
          or(
            sql`${conflictChecks.queryEncrypted} like ${prefix}`,
            sql`${conflictChecks.decisionNotesEncrypted} like ${prefix}`,
          ),
        ),
    ]);
    const [[fp], [fd]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(ficaProfiles)
        .where(sql`${ficaProfiles.notesEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(ficaDocuments)
        .where(
          or(
            sql`${ficaDocuments.fileNameEncrypted} like ${prefix}`,
            sql`${ficaDocuments.encryptedContent} like ${prefix}`,
            eq(ficaDocuments.contentKeyVersion, key.version),
          ),
        ),
    ]);
    const [[te], [tm]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(timeEntries)
        .where(sql`${timeEntries.descriptionEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(timers)
        .where(sql`${timers.descriptionEncrypted} like ${prefix}`),
    ]);
    const [[bi], [bd]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(invoices)
        .where(sql`${invoices.contentEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(disbursements)
        .where(sql`${disbursements.descriptionEncrypted} like ${prefix}`),
    ]);
    const [[ce], [mp]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(calendarEvents)
        .where(sql`${calendarEvents.contentEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(matterPrescriptions)
        .where(sql`${matterPrescriptions.notesEncrypted} like ${prefix}`),
    ]);
    const [[rr], [ac]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(researchRequests)
        .where(
          or(
            sql`${researchRequests.questionEncrypted} like ${prefix}`,
            sql`${researchRequests.briefEncrypted} like ${prefix}`,
            sql`${researchRequests.mappingEncrypted} like ${prefix}`,
            sql`${researchRequests.answerEncrypted} like ${prefix}`,
            sql`${researchRequests.sourcesEncrypted} like ${prefix}`,
            sql`${researchRequests.approvalNoteEncrypted} like ${prefix}`,
          ),
        ),
      db()
        .select({ value: count() })
        .from(aiCalls)
        .where(
          or(
            sql`${aiCalls.promptEncrypted} like ${prefix}`,
            sql`${aiCalls.responseEncrypted} like ${prefix}`,
          ),
        ),
    ]);
    const [[pr]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(firmPrecedents)
        .where(
          or(
            sql`${firmPrecedents.originalEncrypted} like ${prefix}`,
            sql`${firmPrecedents.reviewEncrypted} like ${prefix}`,
          ),
        ),
    ]);
    const [[tac], [ten], [trc]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(trustAccounts)
        .where(sql`${trustAccounts.accountNumberEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(trustEntries)
        .where(
          or(
            sql`${trustEntries.referenceEncrypted} like ${prefix}`,
            sql`${trustEntries.descriptionEncrypted} like ${prefix}`,
          ),
        ),
      db()
        .select({ value: count() })
        .from(trustReconciliations)
        .where(sql`${trustReconciliations.notesEncrypted} like ${prefix}`),
    ]);
    const [[pou], [pom], [cup]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(portalUsers)
        .where(
          or(
            sql`${portalUsers.emailEncrypted} like ${prefix}`,
            sql`${portalUsers.totpSecretEncrypted} like ${prefix}`,
          ),
        ),
      db()
        .select({ value: count() })
        .from(portalMessages)
        .where(sql`${portalMessages.bodyEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(cases)
        .where(sql`${cases.clientUpdateEncrypted} like ${prefix}`),
    ]);
    const [dft] = await db()
      .select({ value: count() })
      .from(documentDrafts)
      .where(sql`${documentDrafts.valuesEncrypted} like ${prefix}`);
    const [[stk], [stm]] = await Promise.all([
      db()
        .select({ value: count() })
        .from(supportTickets)
        .where(sql`${supportTickets.subjectEncrypted} like ${prefix}`),
      db()
        .select({ value: count() })
        .from(supportTicketMessages)
        .where(sql`${supportTicketMessages.bodyEncrypted} like ${prefix}`),
    ]);
    const inUse = [
      s,
      d,
      u,
      p,
      c,
      fp,
      fd,
      te,
      tm,
      bi,
      bd,
      ce,
      mp,
      rr,
      ac,
      pr,
      tac,
      ten,
      trc,
      pou,
      pom,
      cup,
      stk,
      stm,
      dft,
      { value: await countSealedText((column) => sql`${column} like ${prefix}`) },
    ].some((row) => row?.value);
    if (!inUse) {
      await deleteKey(key.id);
      pruned.push(key.version);
    }
  }
  return pruned;
}
