import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ROLE_LABELS,
  hasPermission,
  type AuthConfig,
  type IntakeSubmissionInput,
  type IntakeSummary,
  type MatterCase,
  type MeResponse,
  type Permission,
  type PublicBranding,
  type PublicSubmission,
  type PublicUser,
} from '@ahava88/shared';
import { api, apiErrorMessage, apiStatus } from './api';
import SignIn, { signInErrorMessage } from './auth/SignIn';
import InviteAccept from './auth/InviteAccept';
import ResetPassword from './auth/ResetPassword';
import StaffAdmin from './components/StaffAdmin';
import AccountPanel from './components/AccountPanel';
import RecordsPanel from './components/RecordsPanel';
import ClientsPanel from './components/ClientsPanel';
import TimePanel from './components/TimePanel';
import SignInSettingsPanel from './components/SignInSettingsPanel';
import SupportAccessPanel from './components/SupportAccessPanel';
import SupportSignIn from './auth/SupportSignIn';
import type { Notice } from './components/DismissibleNotice';
import IntakeForm from './components/IntakeForm';
import DraftingPanel from './components/DraftingPanel';
import AssessmentCard from './components/AssessmentCard';
import CaseTable from './components/CaseTable';
import CaseWorkspace from './components/CaseWorkspace';
import OperationsHub from './components/OperationsHub';
import ErrorBoundary from './components/ErrorBoundary';
import DismissibleNotice from './components/DismissibleNotice';
import { refreshBranding, useBranding } from './branding';
import FirmSettingsPanel from './components/FirmSettingsPanel';
import OnboardingWizard from './components/OnboardingWizard';
import SubscriptionBanner from './components/SubscriptionBanner';
import SubscriptionPanel from './components/SubscriptionPanel';
import HelpPanel from './components/HelpPanel';
import PrecedentsPanel from './components/PrecedentsPanel';
import TrustPanel from './components/TrustPanel';
import './App.css';
import './theme.css';

const sampleMatter: Omit<IntakeSubmissionInput, 'consentToAi' | 'consentToStorage'> = {
  fullName: 'Thandi Nkosi',
  email: 'thandi.nkosi@example.com',
  phone: '+27821234567',
  practiceArea: 'Family Law',
  jurisdiction: 'Gauteng Division, Johannesburg',
  urgencyHint: 'high',
  matterSummary:
    'The client wants to move urgently because there is a threatened relocation of the minor child and the other party has stopped complying with an existing parenting plan.',
  requestedOutcome:
    'Emergency advice on custody, contact, and a possible interdict or urgent court application.',
  documentsMentioned:
    "Existing parenting plan, WhatsApp messages, school notices, and the child's birth certificate.",
  preferredLanguage: 'English',
};

type SectionId =
  | 'overview'
  | 'intake'
  | 'clients'
  | 'cases'
  | 'time'
  | 'trust'
  | 'operations'
  | 'account'
  | 'help';

const NAV_SECTIONS: Array<{
  id: SectionId;
  label: string;
  /** The banner's title and subtitle while this section is in view. */
  title: string;
  subtitle: string;
  permission?: Permission;
}> = [
  {
    id: 'overview',
    label: 'Overview',
    title: 'Practice overview',
    subtitle: 'Open intakes, live matters and what needs attention today.',
  },
  {
    id: 'intake',
    label: 'Intake',
    title: 'Client intake',
    subtitle: 'Take a new matter, redact personal information, then assess it.',
  },
  {
    id: 'clients',
    label: 'Clients',
    title: 'Clients',
    subtitle: 'The client register, conflict checks and FICA status.',
    permission: 'clients.read',
  },
  {
    id: 'cases',
    label: 'Cases',
    title: 'Matters',
    subtitle: 'Recent matters, their urgency and the next action on each.',
  },
  {
    id: 'time',
    label: 'Time',
    title: 'Time and fees',
    subtitle: 'Record time in 6-minute units and track work in progress.',
    permission: 'time.read',
  },
  {
    id: 'trust',
    label: 'Trust',
    title: 'Trust accounting',
    subtitle: 'Trust ledgers, deposits and authorised payments.',
    permission: 'trust.read',
  },
  {
    id: 'operations',
    label: 'Operations',
    title: 'Practice operations',
    subtitle: 'Documents, billing, calendar, notifications, reports and compliance.',
  },
  {
    id: 'account',
    label: 'Account & team',
    title: 'Account and team',
    subtitle: 'Your sign-in, firm settings, staff, records and research sources.',
  },
  {
    id: 'help',
    label: 'Help',
    title: 'Help and support',
    subtitle: 'Guides, and requests to the platform support team.',
    permission: 'helpdesk.use',
  },
];

/** Links from emails: /invite/<token> and /reset-password/<token>. */
function linkFromPath(pathname: string) {
  const invite = /^\/invite\/([^/]+)\/?$/.exec(pathname);
  if (invite) return { kind: 'invite' as const, token: decodeURIComponent(invite[1]!) };
  const reset = /^\/reset-password\/([^/]+)\/?$/.exec(pathname);
  if (reset) return { kind: 'reset' as const, token: decodeURIComponent(reset[1]!) };
  if (/^\/support\/?$/.test(pathname)) return { kind: 'support' as const, token: '' };
  return null;
}

function leaveLinkPage() {
  window.history.replaceState(null, '', '/');
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: string;
}

function StatCard({ label, value, detail, tone = 'neutral' }: StatCardProps) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}

function LoadingShell() {
  return (
    <div className="app-shell">
      <div className="loading-shell" aria-busy="true" aria-label="Loading workspace">
        <div className="skeleton-hero" />
        <div className="summary-grid">
          <div className="skeleton-stat" />
          <div className="skeleton-stat" />
          <div className="skeleton-stat" />
          <div className="skeleton-stat" />
        </div>
        <div className="skeleton-panel" />
      </div>
    </div>
  );
}

function BrandMark({ branding }: { branding: PublicBranding }) {
  if (branding.logoUrl) {
    return (
      <img
        className="brand-mark brand-logo"
        src={branding.logoUrl}
        alt={`${branding.firmName} logo`}
      />
    );
  }

  return (
    <div className="brand-mark" aria-hidden="true">
      {(branding.firmShortName || 'F').trim().charAt(0).toUpperCase()}
    </div>
  );
}

function App() {
  const branding = useBranding();
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authNotice, setAuthNotice] = useState<Notice>(() =>
    linkFromPath(window.location.pathname)
      ? { tone: 'info', message: '' }
      : {
          tone: 'info',
          message: 'Sign in with your staff account to access the practice workspace.',
        },
  );
  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    passwordLogin: true,
    oidc: { enabled: false, label: '' },
    microsoft: { enabled: false, label: '', enforced: false },
    selfServiceReset: false,
  });
  const [link, setLink] = useState(() => linkFromPath(window.location.pathname));
  const [sessionInfo, setSessionInfo] = useState<MeResponse['session'] | null>(null);
  const [summary, setSummary] = useState<IntakeSummary | null>(null);
  const [cases, setCases] = useState<MatterCase[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<PublicSubmission | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const [headerCondensed, setHeaderCondensed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  // The section menu closes on Escape or a click outside it.
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [menuOpen]);
  const workspaceReady = useMemo(() => Boolean(currentUser), [currentUser]);

  /** Shows one section of the workspace (one view at a time, not one long page). */
  const showSection = useCallback((sectionId: SectionId) => {
    setActiveSection(sectionId);
    setMenuOpen(false);
    if (window.location.hash !== `#${sectionId}`) {
      window.history.pushState(null, '', `#${sectionId}`);
    }
    window.scrollTo({ top: 0 });
  }, []);

  const loadWorkspace = async (user: PublicUser | null = currentUser) => {
    const role = user?.role;
    const canIntake = hasPermission(role, 'intake.read');
    const canMatters = hasPermission(role, 'matters.read');
    const [summaryResponse, casesResponse, submissionsResponse] = await Promise.all([
      canIntake ? api.get<IntakeSummary>('/intake/summary') : null,
      canMatters ? api.get<MatterCase[]>('/cases') : null,
      canIntake ? api.get<PublicSubmission[]>('/intake/submissions') : null,
    ]);

    setSummary(summaryResponse?.data ?? null);
    setCases(casesResponse?.data ?? []);

    const latest = submissionsResponse?.data[0];
    if (latest) {
      setSelectedMatter(latest);
      setSelectedCaseId(latest.matterCase?.id || latest.matterCase?.submissionId || null);
    }
  };

  const clearWorkspace = () => {
    setCurrentUser(null);
    setSummary(null);
    setCases([]);
    setSelectedMatter(null);
    setSelectedCaseId(null);
  };

  const handleSignedIn = async (user: PublicUser) => {
    if (link) {
      leaveLinkPage();
      setLink(null);
    }
    setCurrentUser(user);
    setAuthNotice({ tone: 'success', message: `Welcome, ${user.fullName || user.email}.` });
    try {
      await loadWorkspace(user);
    } catch (error) {
      setAuthNotice({
        tone: 'error',
        message: apiErrorMessage(error, 'Could not load the workspace.'),
      });
    }
  };

  const loadSession = async () => {
    // The session is an httpOnly cookie: ask the API who we are.
    try {
      const { data } = await api.get<MeResponse>('/auth/me');
      setCurrentUser(data.user);
      setSessionInfo(data.session);
      setAuthNotice({ tone: 'info', message: '' });
      await loadWorkspace(data.user);
    } catch (error) {
      if (apiStatus(error) !== 401) {
        setAuthNotice({
          tone: 'warn',
          message: apiErrorMessage(error, 'Could not reach the server.'),
        });
      }
    } finally {
      setAuthReady(true);
      setLoading(false);
    }
  };

  // A session that ends mid-use (expiry, revocation) returns to sign-in.
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (error: unknown) => {
      const url = (error as { config?: { url?: string } })?.config?.url ?? '';
      if (apiStatus(error) === 401 && !url.startsWith('/auth/')) {
        clearWorkspace();
        setAuthNotice({ tone: 'warn', message: 'Your session has ended. Please sign in again.' });
      }
      return Promise.reject(error);
    });
    return () => api.interceptors.response.eject(id);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await api.get<AuthConfig>('/auth/config');
        setAuthConfig(data);
      } catch (error) {
        // Auth config is optional for rendering the sign-in shell.
      }
      // Entra sign-in errors come back as ?signin_error=<code>.
      const params = new URLSearchParams(window.location.search);
      const signInError = signInErrorMessage(params.get('signin_error'));
      if (signInError) {
        setAuthNotice({ tone: 'error', message: signInError });
        window.history.replaceState(null, '', window.location.pathname);
      }

      await loadSession();
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!workspaceReady) {
      return undefined;
    }

    // The address bar remembers the section (#clients), so Back and links work.
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (NAV_SECTIONS.some((section) => section.id === id)) {
        setActiveSection(id as SectionId);
      }
    };
    fromHash();
    window.addEventListener('popstate', fromHash);

    let frame = 0;
    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          setHeaderCondensed(window.scrollY > 40);
        });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('popstate', fromHash);
      window.removeEventListener('scroll', onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [workspaceReady]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Signing out locally still locks the workspace.
    }
    clearWorkspace();
    setAuthNotice({
      tone: 'info',
      message: 'Signed out. The workspace is now locked.',
    });
  };

  const handleSubmit = async (payload: IntakeSubmissionInput): Promise<boolean> => {
    setBusy(true);
    setAuthNotice({
      tone: 'info',
      message: 'Submitting encrypted intake and generating an attorney-facing assessment...',
    });

    try {
      const submissionResponse = await api.post<PublicSubmission>('/intake/submissions', payload);
      const assessmentResponse = await api.post<PublicSubmission>(
        `/intake/submissions/${submissionResponse.data.id}/assess`,
      );

      setSelectedMatter(assessmentResponse.data);
      setSelectedCaseId(
        assessmentResponse.data.matterCase?.id ||
          assessmentResponse.data.matterCase?.submissionId ||
          assessmentResponse.data.id,
      );
      setAuthNotice({
        tone: 'success',
        message: `Intake ${submissionResponse.data.id} assessed successfully.`,
      });
      await loadWorkspace();
      return true;
    } catch (error) {
      setAuthNotice({
        tone: 'error',
        message: apiErrorMessage(error, 'Unable to submit intake.'),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSelectCase = async (
    caseRow: Pick<MatterCase, 'id' | 'submissionId' | 'caseNumber'>,
  ) => {
    try {
      const caseKey = caseRow.id || caseRow.submissionId || caseRow.caseNumber;
      setSelectedCaseId(caseKey);
      const { data } = await api.get(`/cases/${caseKey}`);
      setSelectedMatter(data);
      showSection('cases');
    } catch (error) {
      setAuthNotice({
        tone: 'error',
        message: 'Could not load the selected matter.',
      });
    }
  };

  if (!authReady || loading) {
    return <LoadingShell />;
  }

  if (!currentUser) {
    return (
      <div className="app-shell auth-shell">
        <header className="hero">
          <div className="hero-copy">
            <BrandMark branding={branding} />
            <div>
              <p className="eyebrow">{branding.firmName}</p>
              <h1>Legal practice management platform</h1>
              <p className="hero-text">
                Encrypted intake, role-based workspace access, case management, and POPIA-safe AI
                triage.
              </p>
            </div>
          </div>
          <div className="hero-badges">
            <span className="pill pill-strong">Secure workspace</span>
            <span className="pill">Two-factor sign-in</span>
            <span className="pill">Case operations</span>
          </div>
        </header>

        <section className="auth-grid">
          <div className="panel">
            <p className="panel-kicker">Staff access</p>
            {link?.kind === 'invite' ? (
              <InviteAccept
                token={link.token}
                config={authConfig}
                onSignedIn={handleSignedIn}
                onNotice={(tone, message) => setAuthNotice({ tone, message })}
              />
            ) : link?.kind === 'support' ? (
              <SupportSignIn
                onSignedIn={() => {
                  leaveLinkPage();
                  window.location.reload();
                }}
                onNotice={(tone, message) => setAuthNotice({ tone, message })}
              />
            ) : link?.kind === 'reset' ? (
              <ResetPassword
                token={link.token}
                onDone={() => {
                  leaveLinkPage();
                  setLink(null);
                }}
                onNotice={(tone, message) => setAuthNotice({ tone, message })}
              />
            ) : (
              <SignIn
                config={authConfig}
                onSignedIn={handleSignedIn}
                onNotice={(tone, message) => setAuthNotice({ tone, message })}
              />
            )}
          </div>

          <DismissibleNotice
            tone={authNotice.tone}
            message={authNotice.message}
            onDismiss={() => setAuthNotice({ tone: 'info', message: '' })}
          />
        </section>
      </div>
    );
  }

  const visibleSections = NAV_SECTIONS.filter(
    ({ permission }) => !permission || currentUser.permissions.includes(permission),
  );
  // A section the user can't see (e.g. from an old link) falls back to the overview.
  const activeNav =
    visibleSections.find((section) => section.id === activeSection) ?? NAV_SECTIONS[0]!;
  const activeLabel = activeNav.label;
  const view = activeNav.id;
  const can = (permission: Permission) => currentUser.permissions.includes(permission);

  const assessmentCard =
    selectedMatter &&
    'submissionId' in selectedMatter &&
    selectedMatter.submissionId === null ? null : (
      <ErrorBoundary label="Assessment">
        <AssessmentCard
          matter={selectedMatter}
          onGoToIntake={() => showSection('intake')}
          onGoToCases={() => showSection('cases')}
        />
      </ErrorBoundary>
    );

  const recentMatters = (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Case management</p>
          <h2>Recent matters</h2>
        </div>
      </div>
      <CaseTable
        cases={cases}
        onSelectCase={handleSelectCase}
        onGoToIntake={() => showSection('intake')}
      />
    </div>
  );

  return (
    <div className="app-shell">
      <div className={`workspace-header ${headerCondensed ? 'workspace-header-condensed' : ''}`}>
        <header className="hero hero-compact">
          <div className="hero-copy">
            <BrandMark branding={branding} />
            <div>
              <p className="eyebrow">{branding.firmName}</p>
              <h1 aria-live="polite">{activeNav.title}</h1>
              <p className="hero-text">{activeNav.subtitle}</p>
            </div>
          </div>
          <div className="user-strip">
            <div className="user-chip" title={currentUser.email}>
              <span className="user-name">{currentUser.fullName || currentUser.email}</span>
              <span className="user-role">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</span>
            </div>
            <button
              type="button"
              className="secondary-button sign-out-button"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </header>

        <nav
          ref={navRef}
          className={`workspace-nav ${menuOpen ? 'workspace-nav-open' : ''}`}
          aria-label="Workspace sections"
        >
          <div className="workspace-nav-inner">
            <div className="breadcrumb" aria-label="Current section">
              <span className="breadcrumb-label">You are in</span>
              <strong>{activeLabel}</strong>
            </div>
            <button
              type="button"
              className="nav-menu-button"
              aria-expanded={menuOpen}
              aria-controls="workspace-nav-links"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="nav-menu-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Menu
            </button>
            <div className="nav-links" id="workspace-nav-links">
              {visibleSections.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`nav-link ${activeSection === id ? 'nav-link-active' : ''}`}
                  onClick={() => showSection(id)}
                  aria-current={activeSection === id ? 'page' : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {sessionInfo?.method === 'support' ? (
        <div className="notice notice-warn support-banner" role="status">
          {branding.platform.legalName} support session: read-only, recorded in the firm's audit
          trail, ends {new Date(sessionInfo.expiresAt).toLocaleString()}.
        </div>
      ) : null}

      <DismissibleNotice
        tone={authNotice.tone}
        message={authNotice.message}
        onDismiss={() => setAuthNotice({ tone: 'info', message: '' })}
      />

      <main className="dashboard" id="workspace-main" aria-label={activeNav.title}>
        <SubscriptionBanner canManage={hasPermission(currentUser.role, 'subscription.manage')} />

        {view === 'overview' ? (
          <>
            {can('users.manage') ? (
              <ErrorBoundary label="Firm setup">
                <OnboardingWizard currentUser={currentUser} onChanged={refreshBranding} />
              </ErrorBoundary>
            ) : null}
            <section className="dashboard-section" data-section="overview">
              <div className="summary-grid">
                <StatCard
                  label="Open intakes"
                  value={summary?.openIntakes ?? 0}
                  detail="New matters waiting for attorney triage"
                  tone="mint"
                />
                <StatCard
                  label="AI assessed"
                  value={summary?.assessedIntakes ?? 0}
                  detail="Redacted briefs analyzed server-side"
                  tone="blue"
                />
                <StatCard
                  label="Live matters"
                  value={summary?.liveCases ?? 0}
                  detail="Cases created from intake submissions"
                  tone="gold"
                />
                <StatCard
                  label="Critical"
                  value={summary?.criticalMatters ?? 0}
                  detail="Priority reviews needing immediate attention"
                  tone="rose"
                />
              </div>
            </section>
            <section className="content-grid">
              <div className="primary-column">{recentMatters}</div>
              <aside className="secondary-column">
                <div className="panel compliance-panel">
                  <p className="panel-kicker">POPIA controls</p>
                  <h2>How the AI path stays safer</h2>
                  <ul className="compliance-list">
                    <li>Raw intake payloads are encrypted before persistence.</li>
                    <li>Only a redacted matter brief is sent to the model.</li>
                    <li>Nothing goes to AI without the client&rsquo;s consent.</li>
                    <li>Assessment output is attorney-facing, not client-facing.</li>
                  </ul>
                </div>
              </aside>
            </section>
          </>
        ) : null}

        {view === 'intake' ? (
          <section className="content-grid" data-section="intake">
            <div className="primary-column">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <p className="panel-kicker">Client intake</p>
                    <h2>Collect the matter, redact PII, then assess it</h2>
                  </div>
                </div>
                {can('intake.write') ? (
                  <IntakeForm
                    onSubmit={handleSubmit}
                    busy={busy}
                    sampleMatter={sampleMatter}
                    onGoToCases={() => showSection('cases')}
                  />
                ) : (
                  <p className="field-hint">Your role can view matters but not take new intakes.</p>
                )}
              </div>
            </div>
            <aside className="secondary-column">{assessmentCard}</aside>
          </section>
        ) : null}

        {view === 'clients' ? (
          <section className="dashboard-section" data-section="clients">
            <ErrorBoundary label="Clients">
              <ClientsPanel
                currentUser={currentUser}
                onMatterOpened={(matter) => {
                  loadWorkspace().catch(() => undefined);
                  handleSelectCase(matter);
                }}
              />
            </ErrorBoundary>
          </section>
        ) : null}

        {view === 'cases' ? (
          <>
            <section className="content-grid" data-section="cases">
              <div className="primary-column">{recentMatters}</div>
              <aside className="secondary-column">
                {assessmentCard}
                <CaseWorkspace
                  api={api}
                  selectedCaseId={selectedCaseId}
                  onSelectCase={handleSelectCase}
                  onChanged={loadWorkspace}
                  canEdit={can('matters.write')}
                  canEditCalendar={can('calendar.write')}
                  canResearch={hasPermission(currentUser.role, 'research.use')}
                  canApproveResearch={hasPermission(currentUser.role, 'research.approve')}
                  canManagePortal={hasPermission(currentUser.role, 'portal.manage')}
                  canWriteMatter={hasPermission(currentUser.role, 'matters.write')}
                  canShareDocuments={hasPermission(currentUser.role, 'documents.write')}
                />
              </aside>
            </section>
            {can('drafting.use') ? (
              <ErrorBoundary label="Drafting">
                <DraftingPanel caseId={selectedCaseId} currentUser={currentUser} />
              </ErrorBoundary>
            ) : null}
          </>
        ) : null}

        {view === 'time' ? (
          <section className="dashboard-section" data-section="time">
            <ErrorBoundary label="Time">
              <TimePanel currentUser={currentUser} cases={cases} selectedCaseId={selectedCaseId} />
            </ErrorBoundary>
          </section>
        ) : null}

        {view === 'trust' ? (
          <section className="dashboard-section" data-section="trust">
            <ErrorBoundary label="Trust accounting">
              <TrustPanel currentUser={currentUser} cases={cases} />
            </ErrorBoundary>
          </section>
        ) : null}

        {view === 'operations' ? (
          <section className="dashboard-section" data-section="operations">
            <ErrorBoundary label="Operations">
              <OperationsHub
                api={api}
                selectedCaseId={selectedCaseId}
                cases={cases}
                currentUser={currentUser}
                onChanged={loadWorkspace}
              />
            </ErrorBoundary>
          </section>
        ) : null}

        {view === 'account' ? (
          <section className="dashboard-section account-grid" data-section="account">
            <AccountPanel currentUser={currentUser} />
            {hasPermission(currentUser.role, 'research.use') ? (
              <ErrorBoundary label="Research sources">
                <PrecedentsPanel canApprove={hasPermission(currentUser.role, 'research.approve')} />
              </ErrorBoundary>
            ) : null}
            {hasPermission(currentUser.role, 'subscription.manage') ? (
              <ErrorBoundary label="Subscription">
                <SubscriptionPanel />
              </ErrorBoundary>
            ) : null}
            {can('users.manage') ? (
              <>
                <ErrorBoundary label="Firm settings">
                  <FirmSettingsPanel onChanged={refreshBranding} />
                </ErrorBoundary>
                <ErrorBoundary label="Staff administration">
                  <StaffAdmin currentUser={currentUser} />
                </ErrorBoundary>
                <ErrorBoundary label="Records">
                  <RecordsPanel />
                </ErrorBoundary>
                <ErrorBoundary label="Sign-in settings">
                  <SignInSettingsPanel />
                </ErrorBoundary>
                <ErrorBoundary label="Support access">
                  <SupportAccessPanel platformName={branding.platform.legalName} />
                </ErrorBoundary>
              </>
            ) : null}
          </section>
        ) : null}

        {view === 'help' ? (
          <section className="dashboard-section" data-section="help">
            <ErrorBoundary label="Help">
              <HelpPanel />
            </ErrorBoundary>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
