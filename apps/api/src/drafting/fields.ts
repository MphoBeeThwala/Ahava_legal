// Field-level checks and formatting shared by the templates.
import type { DraftField, DraftIssue } from '@ahava88/shared';
import { parseDate } from './days';

/** A South African ID number: 13 digits, a real date of birth, a valid Luhn check digit. */
export function validSaIdNumber(value: string): boolean {
  const id = value.replace(/\s/g, '');
  if (!/^\d{13}$/.test(id)) return false;
  const [yy, mm, dd] = [id.slice(0, 2), id.slice(2, 4), id.slice(4, 6)];
  const valid = (century: string) => parseDate(`${century}${yy}-${mm}-${dd}`) !== null;
  if (!valid('19') && !valid('20')) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    let digit = Number(id[12 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Rand amount from "12 500.50", "R12,500.50" or "12500,50"; null if not an amount. */
export function parseRand(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  let text = value.replace(/^\s*R\s*/i, '').replace(/\s/g, '');
  // "12,500.50" (comma thousands) or "12500,50" (comma decimal).
  if (/,\d{2}$/.test(text) && !text.includes('.')) text = text.replace(',', '.');
  text = text.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) {
    const words =
      rest < 20
        ? ONES[rest]!
        : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`;
    parts.push(hundreds ? `and ${words}` : words);
  }
  return parts.join(' ');
}

export function numberInWords(n: number): string {
  if (n === 0) return 'zero';
  const scales: Array<[number, string]> = [
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [size, name] of scales) {
    if (rest >= size) {
      parts.push(`${belowThousand(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest)
    parts.push(rest < 100 && parts.length ? `and ${belowThousand(rest)}` : belowThousand(rest));
  return parts.join(' ');
}

/** 1250050 cents → "R12 500.50 (twelve thousand five hundred rand and fifty cents)". */
export function randWithWords(cents: number): string {
  const rand = Math.floor(cents / 100);
  const c = cents % 100;
  const figures = `R${rand.toLocaleString('en-ZA').replace(/,/g, ' ').replace(/ /g, ' ')}.${String(c).padStart(2, '0')}`;
  const words = `${numberInWords(rand)} rand${c ? ` and ${numberInWords(c)} cents` : ''}`;
  return `${figures} (${words})`;
}

/** Required fields, and each field's own format. */
export function fieldIssues(fields: DraftField[], values: Record<string, string>): DraftIssue[] {
  const issues: DraftIssue[] = [];
  for (const field of fields) {
    const value = (values[field.key] ?? '').trim();
    if (!value) {
      if (field.required) {
        issues.push({ severity: 'must', field: field.key, message: `${field.label} is required.` });
      }
      continue;
    }
    if (field.type === 'date' && !parseDate(value)) {
      issues.push({
        severity: 'must',
        field: field.key,
        message: `${field.label} must be a date (YYYY-MM-DD).`,
      });
    } else if (field.type === 'money' && parseRand(value) === null) {
      issues.push({
        severity: 'must',
        field: field.key,
        message: `${field.label} must be a Rand amount, e.g. 12 500.00.`,
      });
    } else if (
      field.type === 'id_number' &&
      /^\d[\d\s]{11,}$/.test(value) &&
      !validSaIdNumber(value)
    ) {
      issues.push({
        severity: 'must',
        field: field.key,
        message: `${field.label} is not a valid South African ID number (check the digits). Passport numbers are fine.`,
      });
    } else if (field.type === 'number' && !/^\d+$/.test(value)) {
      issues.push({
        severity: 'must',
        field: field.key,
        message: `${field.label} must be a whole number.`,
      });
    } else if (field.type === 'choice' && field.choices && !field.choices.includes(value)) {
      issues.push({
        severity: 'must',
        field: field.key,
        message: `${field.label}: choose one of the options.`,
      });
    }
  }
  return issues;
}
