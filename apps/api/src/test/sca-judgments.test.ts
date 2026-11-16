// Supreme Court of Appeal judgments fetched from the court's website: page
// parsing, politeness (robots.txt, only new judgments downloaded) and import
// into the approved corpus at the SCA's level of authority.
import { beforeAll, describe, expect, test } from 'vitest';
import PDFDocument from 'pdfkit';
import { eq } from 'drizzle-orm';
import { rootDb } from '../db/client';
import { legalDocuments } from '../db/schema';
import { upsertSource } from '../services/corpus.service';
import type { Fetcher } from '../services/court-roll-sources';
import {
  judgmentDate,
  nextListingPage,
  scaJudgmentLinks,
  SCA_ORIGIN,
  syncScaJudgments,
} from '../services/sca-judgments';

const LISTING = `${SCA_ORIGIN}/index.php/component/jdownloads/category/101-judgements-2026`;
const summary = (slug: string) =>
  `/index.php/component/jdownloads/summary/101-judgements-2026/${slug}`;

const PAGE_0 = `
<div class="jd_files">
  <a href="${summary('4680-gore-v-moollajie')}">Gore v Moollajie NO and Others (489/2025) [2026] ZASCA 82 (1 June 2026)</a>
  <span>Case No: 489/2025</span>
  <a href="${summary('4680-gore-v-moollajie')}">Download</a>
  <a href="/images/SCA2026-82ms.pdf">Media Summary</a>
  <a href="${summary('4679-city-of-tshwane')}">Download</a>
  <p>Neutral Citation: City of Tshwane Metropolitan Municipality and Another v Summer Season Trading 63 (Pty) Ltd (988/2024 and 831/2024) [2026] ZASCA 81 (29 May 2026)</p>
  <a href="${summary('4600-notice-to-practitioners')}">Notice to practitioners</a>
  <a href="https://elsewhere.example${summary('9-evil')}">[2026] ZASCA 1 (1 May 2026)</a>
</div>
<ul class="pagination">
  <li><a href="${LISTING}?start=0">Start</a></li>
  <li><a href="${LISTING}?start=10">2</a></li>
  <li><a href="${LISTING}?start=20">3</a></li>
</ul>`;

const PAGE_1 = `
<a href="${summary('4670-ngwadla-v-state')}">Ngwadla v The State (936/2020) [2026] ZASCA 77 (25 May 2026)</a>
<ul class="pagination"><li><a href="${LISTING}?start=0">1</a></li></ul>`;

function pdf(lines: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica').fontSize(10);
    for (const line of lines) doc.text(line);
    doc.end();
  });
}

let judgmentPdf: Buffer;
const requested: string[] = [];

function fakeSite(robots = 'User-agent: *\nDisallow: /administrator/'): Fetcher {
  return async (url) => {
    requested.push(url);
    if (url.endsWith('/robots.txt'))
      return { body: Buffer.from(robots), contentType: 'text/plain' };
    if (url === LISTING) return { body: Buffer.from(PAGE_0), contentType: 'text/html' };
    if (url === `${LISTING}?start=10`)
      return { body: Buffer.from(PAGE_1), contentType: 'text/html' };
    if (url.includes('/jdownloads/send/'))
      return { body: judgmentPdf, contentType: 'application/pdf' };
    throw new Error(`HTTP 404 ${url}`);
  };
}

beforeAll(async () => {
  judgmentPdf = await pdf([
    'THE SUPREME COURT OF APPEAL OF SOUTH AFRICA',
    'JUDGMENT',
    '[1] This appeal concerns the right of a lessee to remain in occupation after the lease was cancelled.',
    '[2] The appeal is upheld with costs.',
  ]);
  await upsertSource({
    code: 'sca',
    name: 'Supreme Court of Appeal',
    kind: 'case_law',
    publisher: 'Supreme Court of Appeal',
    url: SCA_ORIGIN,
    licence: 'Official text, Copyright Act s12(8)(a)',
    approvedBy: 'ops@platform.test',
  });
});

describe('reading the SCA listing', () => {
  test('finds each judgment once, with its citation, date and download address', () => {
    const links = scaJudgmentLinks(PAGE_0, LISTING);
    expect(links.map((link) => link.citation)).toEqual(['[2026] ZASCA 82', '[2026] ZASCA 81']);
    expect(links[0]).toMatchObject({
      title: 'Gore v Moollajie NO and Others (489/2025) [2026] ZASCA 82 (1 June 2026)',
      judgmentDate: '2026-06-01',
      downloadUrl: `${SCA_ORIGIN}/index.php/component/jdownloads/send/101-judgements-2026/4680-gore-v-moollajie`,
    });
    expect(links[1]?.title).toMatch(/^City of Tshwane .* \(29 May 2026\)$/);
    expect(judgmentDate('Something (4 June 2026)')).toBe('2026-06-04');
  });

  test('follows the pagination to the next page and stops on the last', () => {
    expect(nextListingPage(PAGE_0, LISTING)).toBe(`${LISTING}?start=10`);
    expect(nextListingPage(PAGE_1, `${LISTING}?start=10`)).toBeNull();
  });
});

describe('sync', () => {
  test('imports new judgments at the SCA level, politely, and only once', async () => {
    requested.length = 0;
    const first = await syncScaJudgments({ listings: [LISTING], pauseMs: 0, fetcher: fakeSite() });
    expect(first).toMatchObject({ pages: 2, seen: 3, imported: 3, alreadyHeld: 0, failed: [] });
    expect(requested[0]).toBe(`${SCA_ORIGIN}/robots.txt`);
    expect(requested.some((url) => url.includes('SCA2026-82ms.pdf'))).toBe(false);

    const [doc] = await rootDb()
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.citation, '[2026] ZASCA 82'));
    expect(doc).toMatchObject({ authorityLevel: 2, court: 'Supreme Court of Appeal' });
    expect(doc?.url).toContain('/jdownloads/summary/');

    requested.length = 0;
    const second = await syncScaJudgments({ listings: [LISTING], pauseMs: 0, fetcher: fakeSite() });
    expect(second).toMatchObject({ imported: 0, alreadyHeld: 3 });
    expect(requested.some((url) => url.includes('/jdownloads/send/'))).toBe(false);
  });

  test('robots.txt that disallows the site stops it', async () => {
    requested.length = 0;
    const result = await syncScaJudgments({
      listings: [LISTING],
      pauseMs: 0,
      fetcher: fakeSite('User-agent: *\nDisallow: /'),
    });
    expect(result).toMatchObject({ pages: 0, imported: 0 });
    expect(requested).toEqual([`${SCA_ORIGIN}/robots.txt`]);
  });

  test('an unregistered source is refused', async () => {
    await expect(
      syncScaJudgments({ sourceCode: 'not-registered', listings: [LISTING], fetcher: fakeSite() }),
    ).rejects.toThrow(/not registered and approved/);
  });
});
