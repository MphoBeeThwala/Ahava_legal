import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  DRAFTING_CATALOGUE,
  DRAFTING_CATEGORIES,
  ROLE_PERMISSIONS,
  type Draft,
  type DraftingCatalogue,
  type PublicUser,
  type UserRole,
} from '@ahava88/shared';
import { api } from '../api';
import DraftingPanel from './DraftingPanel';

afterEach(() => vi.restoreAllMocks());

const user = (role: UserRole): PublicUser =>
  ({
    id: 'u1',
    email: 'u@example.com',
    fullName: 'User',
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
  }) as PublicUser;

const catalogue: DraftingCatalogue = {
  categories: DRAFTING_CATEGORIES,
  kinds: [...DRAFTING_CATALOGUE],
  templates: [
    {
      id: 'letter-of-demand',
      version: '2026.11-1',
      name: 'Letter of demand',
      category: 'correspondence',
      purpose: 'Demands payment.',
      basis: ['Common law'],
      review: { status: 'unreviewed' },
      format: {
        paper: 'A4',
        fontSizePt: 11,
        lineSpacing: 1.15,
        marginsMm: [25, 25, 25, 25],
        numberedParagraphs: true,
        pageNumbers: true,
        courtHeading: false,
      },
      sections: [
        {
          key: 'recipient',
          title: 'Recipient',
          fields: [{ key: 'debtorName', label: 'Debtor', type: 'text', required: true }],
        },
      ],
    },
  ],
};

const draft: Draft = {
  id: 'd1',
  caseNumber: 'MAT-2026-0001',
  templateId: 'letter-of-demand',
  templateVersion: '2026.11-1',
  title: 'Letter of demand',
  status: 'review',
  values: { debtorName: '' },
  issues: [{ severity: 'must', field: 'debtorName', message: 'Debtor is required.' }],
  preview: 'LETTER OF DEMAND',
  createdAt: '2026-11-16T08:00:00Z',
  updatedAt: '2026-11-16T08:00:00Z',
  createdBy: 'u1',
  submittedAt: '2026-11-16T08:00:00Z',
  finalisedAt: null,
  finalisedBy: null,
  documentId: null,
};

function mockGet(drafts: Draft[]) {
  return vi
    .spyOn(api, 'get')
    .mockImplementation(async (url: string) =>
      url === '/drafting/catalogue' ? { data: catalogue } : { data: drafts },
    );
}

test('every kind of document can be explored; only kinds with a template can be started', async () => {
  mockGet([]);
  render(<DraftingPanel caseId="c1" currentUser={user('paralegal')} />);
  const picker = await screen.findByLabelText('Document');
  await screen.findByRole('option', { name: 'Letter of demand' });
  expect(within(picker).getByRole('option', { name: 'Letter of demand' })).not.toBeDisabled();
  const exception = within(picker).getByRole('option', { name: /Exception \(template coming\)/ });
  expect(exception).not.toBeDisabled();
  fireEvent.change(picker, { target: { value: 'exception' } });
  expect(screen.getByText('Template coming')).toBeInTheDocument();
  expect(screen.getByText(/Uniform Rule 23/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start draft' })).toBeDisabled();
  fireEvent.change(picker, { target: { value: 'letter-of-demand' } });
  expect(screen.getByText('Ready to draft')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start draft' })).toBeEnabled();
});

test('shows the checks; an attorney cannot finalise while a "must fix" item remains', async () => {
  mockGet([draft]);
  render(<DraftingPanel caseId="c1" currentUser={user('attorney')} />);
  fireEvent.click(await screen.findByRole('button', { name: /Letter of demand/ }));
  expect(await screen.findByText('Must fix')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Finalise to matter' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Word' })).toHaveAttribute(
    'href',
    '/api/cases/c1/drafts/d1/file?format=docx',
  );
});

test('a paralegal sees that an attorney finalises', async () => {
  mockGet([draft]);
  render(<DraftingPanel caseId="c1" currentUser={user('paralegal')} />);
  fireEvent.click(await screen.findByRole('button', { name: /Letter of demand/ }));
  expect(await screen.findByText('An attorney finalises this document.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Finalise to matter' })).toBeNull();
});
