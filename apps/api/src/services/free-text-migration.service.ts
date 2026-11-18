// Moves free text written before encryption (matter and task titles,
// timeline messages, document titles and previews, notifications, report
// titles) into its encrypted column and clears the clear-text copy.
// Run once per firm with `ops encrypt-free-text`; it is safe to run again.
import { and, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db/client';
import {
  cases,
  caseTasks,
  caseTimeline,
  documents,
  notifications,
  reportSnapshots,
} from '../db/schema';
import { seal } from './sealed-text';

export interface FreeTextCounts {
  matters: number;
  tasks: number;
  timeline: number;
  documents: number;
  notifications: number;
  reports: number;
}

export async function encryptLegacyFreeText(): Promise<FreeTextCounts> {
  const matterRows = await db()
    .select({ id: cases.id, title: cases.title })
    .from(cases)
    .where(and(isNull(cases.titleEncrypted), ne(cases.title, '')));
  for (const row of matterRows) {
    await db()
      .update(cases)
      .set({ title: null, titleEncrypted: await seal({ title: row.title ?? '' }) })
      .where(eq(cases.id, row.id));
  }

  const taskRows = await db()
    .select({ id: caseTasks.id, title: caseTasks.title, description: caseTasks.description })
    .from(caseTasks)
    .where(isNull(caseTasks.contentEncrypted));
  for (const row of taskRows) {
    await db()
      .update(caseTasks)
      .set({
        title: '',
        description: '',
        contentEncrypted: await seal({ title: row.title, description: row.description }),
      })
      .where(eq(caseTasks.id, row.id));
  }

  const timelineRows = await db()
    .select({ id: caseTimeline.id, message: caseTimeline.message })
    .from(caseTimeline)
    .where(isNull(caseTimeline.contentEncrypted));
  for (const row of timelineRows) {
    await db()
      .update(caseTimeline)
      .set({ message: '', contentEncrypted: await seal({ message: row.message }) })
      .where(eq(caseTimeline.id, row.id));
  }

  const documentRows = await db()
    .select({ id: documents.id, title: documents.title, preview: documents.contentPreview })
    .from(documents)
    .where(isNull(documents.metaEncrypted));
  for (const row of documentRows) {
    await db()
      .update(documents)
      .set({
        title: '',
        contentPreview: '',
        metaEncrypted: await seal({ title: row.title, preview: row.preview }),
      })
      .where(eq(documents.id, row.id));
  }

  const noticeRows = await db()
    .select({ id: notifications.id, title: notifications.title, body: notifications.body })
    .from(notifications)
    .where(isNull(notifications.contentEncrypted));
  for (const row of noticeRows) {
    await db()
      .update(notifications)
      .set({
        title: '',
        body: '',
        contentEncrypted: await seal({ title: row.title, body: row.body }),
      })
      .where(eq(notifications.id, row.id));
  }

  const reportRows = await db()
    .select({ id: reportSnapshots.id, title: reportSnapshots.title })
    .from(reportSnapshots)
    .where(isNull(reportSnapshots.titleEncrypted));
  for (const row of reportRows) {
    await db()
      .update(reportSnapshots)
      .set({ title: '', titleEncrypted: await seal({ title: row.title }) })
      .where(eq(reportSnapshots.id, row.id));
  }

  return {
    matters: matterRows.length,
    tasks: taskRows.length,
    timeline: timelineRows.length,
    documents: documentRows.length,
    notifications: noticeRows.length,
    reports: reportRows.length,
  };
}
