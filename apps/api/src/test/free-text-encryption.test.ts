// Free text staff type (matter, task, document, notification and report
// titles, timeline messages, document previews) can name clients, so it is
// stored encrypted with the firm key: no row holds it in clear text, the API
// still returns it, the firm export decrypts it, and rows written before
// encryption are moved by `ops encrypt-free-text`.
import { beforeAll, expect, test } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../server';
import { db } from '../db/client';
import {
  cases,
  caseTasks,
  caseTimeline,
  documents,
  notifications,
  reportSnapshots,
} from '../db/schema';
import { encryptLegacyFreeText } from '../services/free-text-migration.service';
import { exportFirm } from '../services/firm-export.service';
import { createStaff, defaultFirm, inDefaultFirm, type TestStaff } from './helpers';

const NAME = 'Thandeka Mabuza-Nkosi';
let attorney: TestStaff;
let caseId = '';

const as = (r: request.Test) => r.set(attorney.auth);

beforeAll(async () => {
  attorney = await createStaff({ email: 'attorney@free-text.example', role: 'attorney' });
  const check = await as(request(app).post('/api/conflicts')).send({
    subjects: [{ name: NAME }],
    purpose: 'New instruction',
  });
  await as(request(app).post(`/api/conflicts/${check.body.id}/decision`)).send({
    decision: 'clear',
  });
  const client = await as(request(app).post('/api/clients')).send({
    kind: 'individual',
    details: { name: NAME },
    conflictCheckId: check.body.id,
  });
  const matter = await as(request(app).post('/api/cases')).send({
    clientId: client.body.id,
    conflictCheckId: check.body.id,
    title: `Transfer for ${NAME}`,
    practiceArea: 'Conveyancing',
  });
  expect(matter.status, JSON.stringify(matter.body)).toBe(201);
  caseId = matter.body.id;
});

test('no free text is stored in clear, and the API still returns it', async () => {
  const task = await as(request(app).post(`/api/cases/${caseId}/tasks`)).send({
    title: `Call ${NAME}`,
    description: `${NAME} prefers mornings`,
  });
  expect(task.status, JSON.stringify(task.body)).toBe(201);
  await as(request(app).post(`/api/cases/${caseId}/timeline`)).send({
    eventType: 'note',
    message: `Met ${NAME} at the office`,
  });
  const document = await as(request(app).post('/api/documents')).send({
    caseId,
    title: `Offer for ${NAME}`,
    body: `${NAME} offers R1 200 000`,
  });
  expect(document.status, JSON.stringify(document.body)).toBe(201);
  await as(request(app).post('/api/notifications')).send({
    title: `${NAME} called`,
    body: `Return ${NAME}'s call`,
    category: 'general',
  });
  await as(request(app).post('/api/reports')).send({ title: `Report on ${NAME}` });

  const raw = await inDefaultFirm(async () =>
    JSON.stringify([
      await db().select().from(cases),
      await db().select().from(caseTasks),
      await db().select().from(caseTimeline),
      await db().select().from(documents),
      await db().select().from(notifications),
      await db().select().from(reportSnapshots),
    ]),
  );
  expect(raw).not.toContain('Mabuza');

  const detail = await as(request(app).get(`/api/cases/${caseId}`));
  expect(detail.body.title).toBe(`Transfer for ${NAME}`);
  expect(detail.body.tasks[0]).toMatchObject({
    title: `Call ${NAME}`,
    description: `${NAME} prefers mornings`,
  });
  expect(detail.body.timeline.map((entry: { message: string }) => entry.message)).toEqual(
    expect.arrayContaining([`Met ${NAME} at the office`, `Task created: Call ${NAME}`]),
  );
  const list = await as(request(app).get('/api/documents'));
  expect(list.body.find((row: { id: string }) => row.id === document.body.id)).toMatchObject({
    title: `Offer for ${NAME}`,
    contentPreview: `${NAME} offers R1 200 000`,
  });
  const notices = await as(request(app).get('/api/notifications'));
  expect(notices.body.some((row: { title: string }) => row.title === `${NAME} called`)).toBe(true);
  const reports = await as(request(app).get('/api/reports'));
  expect(reports.body.some((row: { title: string }) => row.title === `Report on ${NAME}`)).toBe(
    true,
  );

  const exported = JSON.stringify((await exportFirm(await defaultFirm())).tables);
  expect(exported).toContain(`Call ${NAME}`);
  expect(exported).toContain(`Offer for ${NAME}`);
  expect(exported).toContain(`Transfer for ${NAME}`);
});

test('ops encrypt-free-text moves rows written before encryption', async () => {
  const legacy = `Legacy note about ${NAME}`;
  await inDefaultFirm(async () => {
    await db()
      .insert(caseTimeline)
      .values({ caseId, eventType: 'note', message: legacy, actorName: 'Old system' });
    await db()
      .update(cases)
      .set({ title: legacy, titleEncrypted: null })
      .where(eq(cases.id, caseId));
  });
  // Still readable before the move.
  const before = await as(request(app).get(`/api/cases/${caseId}`));
  expect(before.body.title).toBe(legacy);

  const done = await inDefaultFirm(() => encryptLegacyFreeText());
  expect(done.timeline).toBe(1);
  expect(done.matters).toBe(1);
  expect(await inDefaultFirm(() => encryptLegacyFreeText())).toMatchObject({
    timeline: 0,
    matters: 0,
  });

  const raw = await inDefaultFirm(async () =>
    JSON.stringify([await db().select().from(caseTimeline), await db().select().from(cases)]),
  );
  expect(raw).not.toContain('Legacy note');
  const after = await as(request(app).get(`/api/cases/${caseId}`));
  expect(after.body.title).toBe(legacy);
  expect(after.body.timeline.map((entry: { message: string }) => entry.message)).toContain(legacy);
});
