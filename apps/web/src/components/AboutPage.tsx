import '@fontsource/libre-caslon-text/400.css';
import '@fontsource/libre-caslon-text/400-italic.css';
import '@fontsource/libre-caslon-text/700.css';
import {
  DEFAULT_FIRM_BRAND,
  PLATFORM_CONTACT_EMAIL,
  PLATFORM_CONTACT_PHONE,
  PLATFORM_PRODUCT_NAME,
  type PublicBranding,
} from '@ahava88/shared';
import './about.css';

// The page behind the logo: what the software is, how it protects client
// information, who owns it and how to reach them. It describes the
// platform, so its identity is the owner's; the firm using it is named in
// one line.

const LIFECYCLE = [
  {
    stage: 'Intake',
    text: "The client's account is recorded, and names and identity numbers are removed before any AI reads it.",
  },
  {
    stage: 'Conflict check',
    text: 'Every party is checked against every matter without names leaving the encrypted record.',
  },
  {
    stage: 'FICA',
    text: 'Identity documents are collected and verified before the work starts.',
  },
  {
    stage: 'Work and time',
    text: 'Drafting from standard templates reviewed by an admitted attorney, research from approved sources, and time in six-minute units.',
  },
  {
    stage: 'Invoice',
    text: 'VAT invoices numbered without gaps, emailed to the client and shown in the client portal.',
  },
  {
    stage: 'Trust',
    text: 'Trust money kept per matter, with payments out authorised by a second person.',
  },
];

const FEATURES: Array<[string, string]> = [
  ['Matters and clients', 'Parties, conflict checks, FICA, tasks and a timeline for every matter.'],
  [
    'Calendar and court rolls',
    'Court dates and deadlines, with roll matches sent to the matter team.',
  ],
  [
    'Drafting',
    'Pleadings, notices, agreements and letters built from the matter, checked against the rules.',
  ],
  ['Research', 'Answers drawn only from approved legal sources, with every statement cited.'],
  [
    'Billing and trust',
    'Time, disbursements, invoices and a trust ledger that cannot go into debit.',
  ],
  ['Client portal', 'Clients sign in to see shared documents, invoices and messages.'],
];

const SAFEGUARDS = [
  "Client information is encrypted with each firm's own key before it is stored.",
  "Each firm's records are kept apart in the database itself, not only in the screens.",
  'Staff sign in with a password and an authenticator code; clients with an emailed link and a code.',
  'AI receives only text with personal details removed, and its answers must cite their sources.',
  'Designed to help firms meet their duties under the Protection of Personal Information Act.',
];

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

interface AboutPageProps {
  branding: PublicBranding;
  /** Signed in: back to the workspace; signed out: to the sign-in page. */
  signedIn: boolean;
  onClose: () => void;
}

function AboutPage({ branding, signedIn, onClose }: AboutPageProps) {
  const platform = branding.platform;
  const product = platform.productName || PLATFORM_PRODUCT_NAME;
  const email = platform.contactEmail || PLATFORM_CONTACT_EMAIL;
  const phone = platform.contactPhone || PLATFORM_CONTACT_PHONE;
  const owner = platform.legalName;
  const firm = branding.firmName !== DEFAULT_FIRM_BRAND.firmName ? branding.firmName : null;
  const year = new Date().getFullYear();

  return (
    <div className="about">
      <header className="about-hero">
        <div className="about-inner">
          <div className="about-wordmark">
            <img src="/icons/icon.svg" alt="" width={44} height={44} />
            <span>{product}</span>
          </div>
          <h1>Practice management for South African law firms</h1>
          <p className="about-lede">
            {product} keeps a firm’s matters, time, billing, trust money and client records in one
            place, with client information encrypted under the firm’s own key.
          </p>
          <div className="about-actions">
            <button type="button" className="about-primary" onClick={onClose}>
              {signedIn ? 'Back to the workspace' : 'Sign in'}
            </button>
            <a className="about-secondary" href={`mailto:${email}`}>
              Email us
            </a>
          </div>
          {firm ? (
            <p className="about-licence">
              You are using {firm}’s workspace, licensed from {owner}.
            </p>
          ) : null}
        </div>
      </header>

      <main className="about-inner about-body">
        <section className="about-lifecycle" aria-labelledby="about-lifecycle-title">
          <h2 id="about-lifecycle-title">How a matter moves through the firm</h2>
          <ol>
            {LIFECYCLE.map((step) => (
              <li key={step.stage}>
                <span className="about-stage">{step.stage}</span>
                <span className="about-stage-text">{step.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="about-section" aria-labelledby="about-what">
          <h2 id="about-what" className="about-margin">
            What it does
          </h2>
          <dl className="about-features">
            {FEATURES.map(([term, description]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="about-section" aria-labelledby="about-protect">
          <h2 id="about-protect" className="about-margin">
            How client information is protected
          </h2>
          <ul className="about-safeguards">
            {SAFEGUARDS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="about-section" aria-labelledby="about-who">
          <h2 id="about-who" className="about-margin">
            Who we are
          </h2>
          <div className="about-prose">
            <p>
              {product} is built and owned by {owner}, a South African company. Law firms license it
              by monthly subscription and use it under their own name, logo and colours.
            </p>
            <p>Each firm’s records stay its own: the firm can export all of them at any time.</p>
          </div>
        </section>

        <section className="about-section" aria-labelledby="about-contact">
          <h2 id="about-contact" className="about-margin">
            Contact
          </h2>
          <div className="about-contact">
            <a href={`mailto:${email}`}>{email}</a>
            <a href={telHref(phone)}>{phone}</a>
            <p>
              {signedIn
                ? 'For help with the workspace, you can also open Help and send a support request.'
                : 'To license the software for your firm, or for a demonstration, email or call us.'}
            </p>
          </div>
        </section>
      </main>

      <footer className="about-footer">
        <div className="about-inner">
          © {year} {owner}. {product} is a product of {owner}.
        </div>
      </footer>
    </div>
  );
}

export default AboutPage;
