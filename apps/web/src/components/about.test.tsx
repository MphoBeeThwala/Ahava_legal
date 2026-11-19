import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AboutPage from './AboutPage';
import { DEFAULT_BRANDING } from '../branding';

describe('about page', () => {
  test('names the owner, gives the contact details and returns to the workspace', () => {
    const onClose = vi.fn();
    render(
      <AboutPage
        branding={{ ...DEFAULT_BRANDING, firmName: 'Thwala & Zulu Partners Inc.' }}
        signedIn
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /South African law firms/,
    );
    expect(screen.getByRole('link', { name: 'legal@ahavaon88.co.za' }).getAttribute('href')).toBe(
      'mailto:legal@ahavaon88.co.za',
    );
    expect(screen.getByRole('link', { name: '+27 65 791 8705' }).getAttribute('href')).toBe(
      'tel:+27657918705',
    );
    expect(screen.getAllByText(/Ahava on 88 \(Pty\) Ltd/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Thwala & Zulu Partners Inc\.’s workspace/)).toBeTruthy();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(6);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the workspace' }));
    expect(onClose).toHaveBeenCalled();
  });

  test('signed out, it leads to sign-in and does not name a firm', () => {
    render(<AboutPage branding={DEFAULT_BRANDING} signedIn={false} onClose={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText(/workspace, licensed from/)).toBeNull();
  });
});
