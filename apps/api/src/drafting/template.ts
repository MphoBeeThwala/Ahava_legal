// What a standard template is: its summary (shared with the web app), the
// defaults it starts with, how it builds the document, and its checks.
import type { DraftFormat, DraftIssue, DraftSection, DraftTemplateSummary } from '@ahava88/shared';
import type { DocModel } from './model';
import { longDate } from './days';

export interface DraftContext {
  today: string;
  caseNumber: string;
  firm: { legalName: string; address: string; email: string; phone: string };
}

export interface DraftTemplate extends DraftTemplateSummary {
  defaults?: Record<string, string>;
  build(values: Record<string, string>, ctx: DraftContext): DocModel;
  /** Template-specific checks; required fields and formats are checked for every template. */
  checks(values: Record<string, string>, ctx: DraftContext): DraftIssue[];
}

/** Court documents: A4, 12 pt, 1.5 spacing, wide left margin for binding (Uniform Rule 62; MC Rule 63). */
export const COURT_FORMAT: DraftFormat = {
  paper: 'A4',
  fontSizePt: 12,
  lineSpacing: 1.5,
  marginsMm: [25, 25, 25, 35],
  numberedParagraphs: true,
  pageNumbers: true,
  courtHeading: true,
};

/** Letters and notices on the firm's letterhead. */
export const LETTER_FORMAT: DraftFormat = {
  paper: 'A4',
  fontSizePt: 11,
  lineSpacing: 1.15,
  marginsMm: [25, 25, 25, 25],
  numberedParagraphs: true,
  pageNumbers: true,
  courtHeading: false,
};

/** Agreements, powers of attorney and wills. */
export const AGREEMENT_FORMAT: DraftFormat = {
  paper: 'A4',
  fontSizePt: 11,
  lineSpacing: 1.3,
  marginsMm: [25, 25, 25, 25],
  numberedParagraphs: true,
  pageNumbers: true,
  courtHeading: false,
};

export const UNREVIEWED = { status: 'unreviewed' as const };

/** Standard wording approved for use by the reviewing attorney (review tracker, 17 November 2026). */
export const APPROVED = {
  status: 'reviewed' as const,
  by: 'Dumisani Lukhele',
  on: '2026-11-17',
};

export const v = (values: Record<string, string>, key: string) => (values[key] ?? '').trim();

/** Non-empty lines of a long-text field. */
export const lines = (values: Record<string, string>, key: string) =>
  v(values, key)
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^\d+[.)]\s*/, '')
        .replace(/^[-*•]\s*/, ''),
    )
    .filter(Boolean);

/** A placeholder that is obvious in a draft: [Debtor's name]. */
export const or = (value: string, placeholder: string) => value || `[${placeholder}]`;

export function letterhead(
  ctx: DraftContext,
  values: Record<string, string>,
  to: string[],
): string[] {
  return [
    ctx.firm.legalName,
    ...ctx.firm.address.split('\n').filter(Boolean),
    [ctx.firm.phone && `Tel: ${ctx.firm.phone}`, ctx.firm.email && `Email: ${ctx.firm.email}`]
      .filter(Boolean)
      .join(' | '),
    '',
    longDate(v(values, 'letterDate') || ctx.today),
    ...(v(values, 'ourRef') ? [`Our ref: ${v(values, 'ourRef')}`] : []),
    ...(v(values, 'yourRef') ? [`Your ref: ${v(values, 'yourRef')}`] : []),
    '',
    ...to,
  ];
}

export type Sections = DraftSection[];
