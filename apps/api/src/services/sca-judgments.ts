// Supreme Court of Appeal judgments, fetched politely from the court's own
// website (official texts: Copyright Act s12(8)(a)) into the approved corpus.
//
// The SCA publishes each year's judgments on a listing page
// (…/component/jdownloads/category/<id>-judgements-<year>), ten to a page
// (?start=0, 10, 20…). Each entry links to a summary page
// (…/jdownloads/summary/<category>/<id>-<slug>); the file itself is the same
// address with "summary" replaced by "send".
//
// The sync identifies itself, honours robots.txt, waits between requests,
// caps sizes and times out (httpFetcher), downloads only judgments it does
// not have yet, and never sends cookies or credentials. Media summaries are
// not imported: they are the court's press notes, not the judgment.
import { and, eq } from 'drizzle-orm';
import { rootDb } from '../db/client';
import { legalDocuments, legalSources } from '../db/schema';
import {
  extractText,
  htmlToText,
  httpFetcher,
  robotsAllows,
  rollFormat,
  type Fetcher,
} from './court-roll-sources';
import { importDocument } from './corpus.service';

export const SCA_ORIGIN = 'https://www.supremecourtofappeal.org.za';

/** Default listings: the current and previous year's judgments. */
export const DEFAULT_SCA_LISTINGS = [
  `${SCA_ORIGIN}/index.php/component/jdownloads/category/101-judgements-2026`,
  `${SCA_ORIGIN}/index.php/component/jdownloads/category/98-judgements-2025`,
];

export interface ScaJudgmentLink {
  /** The court's summary page: the URL stored with the judgment. */
  summaryUrl: string;
  /** The file itself. */
  downloadUrl: string;
  title: string;
  /** Neutral citation, e.g. "[2026] ZASCA 82". */
  citation: string;
  /** YYYY-MM-DD, from the title, when it carries a date. */
  judgmentDate: string | null;
}

const MONTHS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

const NEUTRAL_CITATION = /\[((?:19|20)\d{2})\]\s*ZASCA\s*(\d{1,4})\b/i;
const DATED = /\((\d{1,2})\s+([A-Za-z]+)\s+((?:19|20)\d{2})\)\s*$/;
const SUMMARY_PATH = /\/component\/jdownloads\/summary\/[^"'?#\s]+/i;

/** "Gore v Moollajie (489/2025) [2026] ZASCA 82 (1 June 2026)" → 2026-06-01. */
export function judgmentDate(title: string): string | null {
  const match = DATED.exec(title.trim());
  if (!match) return null;
  const month = MONTHS[match[2]!.toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1]!.padStart(2, '0')}`;
}

export function neutralCitation(text: string): string | null {
  const match = NEUTRAL_CITATION.exec(text);
  return match ? `[${match[1]}] ZASCA ${Number(match[2])}` : null;
}

/** The judgments a listing page links to (each once, in page order). */
export function scaJudgmentLinks(html: string, pageUrl: string): ScaJudgmentLink[] {
  const links: ScaJudgmentLink[] = [];
  const seen = new Set<string>();
  const anchor = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (let match = anchor.exec(html); match; match = anchor.exec(html)) {
    const href = match[1]!.replace(/&amp;/g, '&');
    if (!SUMMARY_PATH.test(href)) continue;
    const summary = new URL(href, pageUrl);
    summary.search = '';
    summary.hash = '';
    const summaryUrl = summary.toString();
    if (seen.has(summaryUrl) || summary.origin !== new URL(pageUrl).origin) continue;
    // The entry's own words: the link text, else the text just after it
    // ("Neutral citation: …").
    let title = htmlToText(match[2]!).replace(/\s+/g, ' ').trim();
    if (!neutralCitation(title)) {
      const after = htmlToText(html.slice(anchor.lastIndex, anchor.lastIndex + 1500))
        .replace(/\s+/g, ' ')
        .trim();
      const cited = /Neutral\s+citation:?\s*(.+?\((?:\d{1,2}\s+[A-Za-z]+\s+\d{4})\))/i.exec(after);
      if (cited) title = cited[1]!.trim();
    }
    const citation = neutralCitation(title);
    if (!citation) continue; // not a judgment (e.g. a notice)
    seen.add(summaryUrl);
    links.push({
      summaryUrl,
      downloadUrl: summaryUrl.replace('/jdownloads/summary/', '/jdownloads/send/'),
      title: title.replace(/^Neutral\s+citation:?\s*/i, ''),
      citation,
      judgmentDate: judgmentDate(title),
    });
  }
  return links;
}

/** The next page of a listing (?start=N), or null on the last page. */
export function nextListingPage(html: string, pageUrl: string): string | null {
  const current = Number(new URL(pageUrl).searchParams.get('start') ?? 0);
  const base = new URL(pageUrl);
  base.search = '';
  let next: number | null = null;
  const starts = /[?&](?:amp;)?start=(\d+)/g;
  for (let match = starts.exec(html); match; match = starts.exec(html)) {
    const value = Number(match[1]);
    if (value > current && (next === null || value < next)) next = value;
  }
  return next === null ? null : `${base.toString()}?start=${next}`;
}

export interface ScaSyncResult {
  pages: number;
  seen: number;
  imported: number;
  /** Already in the corpus: not downloaded again. */
  alreadyHeld: number;
  failed: Array<{ citation: string; reason: string }>;
}

export interface ScaSyncOptions {
  sourceCode?: string;
  listings?: string[];
  /** Listing pages per listing (default 3: the 30 newest judgments). */
  maxPages?: number;
  /** New judgments downloaded per run (default 25). */
  limit?: number;
  pauseMs?: number;
  fetcher?: Fetcher;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Listings from SCA_JUDGMENT_LISTINGS (comma-separated https URLs), else the defaults. */
export function configuredListings(raw = process.env.SCA_JUDGMENT_LISTINGS): string[] {
  const listed = (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const url of listed) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.origin !== SCA_ORIGIN) {
      throw new Error(`SCA_JUDGMENT_LISTINGS must be ${SCA_ORIGIN} pages: ${url}`);
    }
  }
  return listed.length ? listed : DEFAULT_SCA_LISTINGS;
}

/**
 * Imports SCA judgments the corpus doesn't have yet. The source must be
 * registered and approved first (ops sources add --code sca …).
 */
export async function syncScaJudgments(options: ScaSyncOptions = {}): Promise<ScaSyncResult> {
  const sourceCode = options.sourceCode ?? 'sca';
  const fetcher = options.fetcher ?? httpFetcher;
  const pause = options.pauseMs ?? 2_000;
  const maxPages = options.maxPages ?? 3;
  const limit = options.limit ?? 25;
  const listings = options.listings ?? configuredListings();

  const [source] = await rootDb()
    .select()
    .from(legalSources)
    .where(eq(legalSources.code, sourceCode));
  if (!source || source.status !== 'approved') {
    throw new Error(`Source "${sourceCode}" is not registered and approved (ops sources add).`);
  }

  const result: ScaSyncResult = { pages: 0, seen: 0, imported: 0, alreadyHeld: 0, failed: [] };
  const robots = await fetcher(`${SCA_ORIGIN}/robots.txt`)
    .then((doc) => doc.body.toString('utf8'))
    .catch(() => '');
  const allowed = (url: string) => robotsAllows(robots, new URL(url).pathname);

  for (const listing of listings) {
    let page: string | null = listing;
    let pages = 0;
    while (page && pages < maxPages && result.imported < limit) {
      if (!allowed(page)) break;
      const html = (await fetcher(page)).body.toString('utf8');
      pages += 1;
      result.pages += 1;
      for (const link of scaJudgmentLinks(html, page)) {
        if (result.imported >= limit) break;
        result.seen += 1;
        const [held] = await rootDb()
          .select({ id: legalDocuments.id })
          .from(legalDocuments)
          .where(
            and(eq(legalDocuments.sourceId, source.id), eq(legalDocuments.citation, link.citation)),
          )
          .limit(1);
        if (held) {
          result.alreadyHeld += 1;
          continue;
        }
        if (!allowed(link.downloadUrl)) {
          result.failed.push({ citation: link.citation, reason: 'robots.txt disallows it' });
          continue;
        }
        try {
          await sleep(pause);
          const file = await fetcher(link.downloadUrl);
          const format = rollFormat(file.body, file.contentType, `${link.title}.pdf`);
          if (format !== 'pdf' && format !== 'docx') {
            throw new Error('not a PDF or Word document');
          }
          const text = await extractText(file.body, format);
          await importDocument(sourceCode, {
            title: link.title,
            citation: link.citation,
            url: link.summaryUrl,
            court: 'Supreme Court of Appeal',
            authorityLevel: 2,
            versionDate: link.judgmentDate,
            effectiveDate: link.judgmentDate,
            text,
          });
          result.imported += 1;
        } catch (error) {
          result.failed.push({
            citation: link.citation,
            reason: error instanceof Error ? error.message : 'failed',
          });
        }
      }
      page = nextListingPage(html, page);
      if (page) await sleep(pause);
    }
  }
  return result;
}

/** Optional in-process schedule (SCA_SYNC_INTERVAL_HOURS); a scheduled job is better. */
export function scheduleScaSync(): NodeJS.Timeout | null {
  const hours = Number(process.env.SCA_SYNC_INTERVAL_HOURS ?? 0);
  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  const timer = setInterval(() => {
    syncScaJudgments()
      .then((result) =>
        console.log(
          `SCA sync: ${result.imported} imported, ${result.alreadyHeld} already held, ${result.failed.length} failed`,
        ),
      )
      .catch((error: unknown) =>
        console.error('SCA sync failed:', error instanceof Error ? error.message : error),
      );
  }, hours * 3_600_000);
  timer.unref();
  return timer;
}
