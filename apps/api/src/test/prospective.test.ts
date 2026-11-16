// People taken in through intake are prospective clients in the register:
// client search and conflict checks find them; a cleared check makes them
// clients; deleting their only intake removes them.
import { beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../server';
import { db } from '../db/client';
import { parties } from '../db/schema';
import { createFirm } from '../services/firm.service';
import { deleteSubmissions } from '../services/intake.service';
import { createStaff, inDefaultFirm, type TestStaff } from './helpers';

let admin: TestStaff;

const PERSON = {
  fullName: 'Lerato Mokoena',
  email: 'lerato@prospect.example',
  phone: '+27 72 555 0101',
  practiceArea: 'Labour Law',
  matterSummary: 'Dismissed after a disciplinary hearing; wants to challenge it.',
  consentToAi: true,
  consentToStorage: true,
};

async function intake(staff: TestStaff, body: object, host?: string) {
  let req = request(app).post('/api/intake/submissions').set(staff.auth);
  if (host) req = req.set('Host', host);
  const res = await req.send(body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: string };
}

async function searchClients(staff: TestStaff, q: string, host?: string) {
  let req = request(app).get('/api/clients').query({ q }).set(staff.auth);
  if (host) req = req.set('Host', host);
  const res = await req;
  expect(res.status).toBe(200);
  return res.body as Array<{ id: string; name: string; prospective: boolean; isClient: boolean }>;
}

beforeAll(async () => {
  admin = await createStaff({ email: 'admin@prospect.example', role: 'admin' });
});

describe('prospective clients from intake', () => {
  let submissionId: string;
  let partyId: string;

  test('an intake puts the person in the register as a prospective client', async () => {
    submissionId = (await intake(admin, PERSON)).id;
    const byName = await searchClients(admin, 'Lerato Mokoena');
    expect(byName).toHaveLength(1);
    expect(byName[0]).toMatchObject({ name: 'Lerato Mokoena', prospective: true, isClient: false });
    partyId = byName[0]!.id;
  });

  test('found by email, and by phone typed with or without spaces', async () => {
    for (const q of ['lerato@prospect.example', '0725550101', '072 555 0101', '+27 72 555 0101']) {
      const found = await searchClients(admin, q);
      expect(
        found.map((p) => p.id),
        q,
      ).toEqual([partyId]);
    }
  });

  test('a second intake for the same email reuses the same register entry', async () => {
    await intake(admin, { ...PERSON, phone: '0110000000', matterSummary: 'A second matter.' });
    expect(await searchClients(admin, 'Lerato')).toHaveLength(1);
  });

  test('conflict checks find the prospective client', async () => {
    const res = await request(app)
      .post('/api/conflicts')
      .set(admin.auth)
      .send({ subjects: [{ name: 'Someone Else', email: PERSON.email }], purpose: 'New matter' });
    expect(res.status).toBe(201);
    expect(res.body.matches.some((m: { party: { id: string } }) => m.party.id === partyId)).toBe(
      true,
    );
  });

  test('a cleared conflict check makes them a client', async () => {
    const checked = await request(app)
      .post('/api/conflicts')
      .set(admin.auth)
      .send({ subjects: [{ name: PERSON.fullName, email: PERSON.email }], purpose: 'Take on' });
    await request(app)
      .post(`/api/conflicts/${checked.body.id}/decision`)
      .set(admin.auth)
      .send({ decision: 'clear', notes: 'Same person' })
      .expect(200);
    const converted = await request(app)
      .post(`/api/clients/${partyId}/convert`)
      .set(admin.auth)
      .send({ conflictCheckId: checked.body.id });
    expect(converted.status, JSON.stringify(converted.body)).toBe(200);
    expect(converted.body).toMatchObject({ isClient: true, prospective: false });
  });

  test('ID numbers typed with spaces find a client', async () => {
    const checked = await request(app)
      .post('/api/conflicts')
      .set(admin.auth)
      .send({ subjects: [{ name: 'Sipho Dlamini', idNumber: '8001015009087' }], purpose: 'x' });
    await request(app)
      .post(`/api/conflicts/${checked.body.id}/decision`)
      .set(admin.auth)
      .send({ decision: 'clear' })
      .expect(200);
    await request(app)
      .post('/api/clients')
      .set(admin.auth)
      .send({
        kind: 'individual',
        details: { name: 'Sipho Dlamini', idNumber: '8001015009087' },
        conflictCheckId: checked.body.id,
      })
      .expect(201);
    const found = await searchClients(admin, '800101 5009 087');
    expect(found.map((p) => p.name)).toEqual(['Sipho Dlamini']);
  });

  test('another firm cannot find them', async () => {
    const other = await createFirm({
      slug: 'prospect-other',
      legalName: 'Other',
      domains: ['portal.prospect-other.test'],
    });
    const otherAdmin = await createStaff({
      firm: other,
      host: 'portal.prospect-other.test',
      email: 'a@prospect-other.example',
      role: 'admin',
    });
    expect(await searchClients(otherAdmin, PERSON.email, 'portal.prospect-other.test')).toEqual([]);
  });
});

describe('deleting intakes', () => {
  test('a prospective client goes with their only intake', async () => {
    const person = { ...PERSON, fullName: 'Nomsa Zulu', email: 'nomsa@prospect.example' };
    const { id } = await intake(admin, { ...person, phone: '0839990000' });
    const [found] = await searchClients(admin, 'nomsa@prospect.example');
    expect(found?.prospective).toBe(true);

    await inDefaultFirm(() => deleteSubmissions([id]));
    expect(await searchClients(admin, 'nomsa@prospect.example')).toEqual([]);
    const left = await inDefaultFirm(() =>
      db().select().from(parties).where(eq(parties.id, found!.id)),
    );
    expect(left).toEqual([]);
  });
});
