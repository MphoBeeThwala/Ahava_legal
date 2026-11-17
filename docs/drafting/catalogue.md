# Drafting: document catalogue, standards and review

Research notes behind the drafting module (roadmap 15a). The catalogue (`packages/shared/src/drafting.ts`) lists every kind of document in daily use in South African legal practice. The standard templates (`apps/api/src/drafting/templates/`) are versioned in code, so every change to standard wording is reviewed like any other change.

**Wording is a joint effort.** Templates ship as `review: unreviewed`. The designated reviewer of the standard wording is **Dumisani Lukhele** (admitted attorney). Each template is marked reviewed only after he has signed it off, which is recorded in the template's `review` field with name and date. Until then, every draft carries a note to read the whole document before finalising. Every draft goes **draft → review → final**: anyone with `drafting.use` drafts and submits, and an attorney (`drafting.approve`) finalises. Finalising is blocked while any "must fix" check fails, and it saves the document to the matter.

## Format rules the generator follows

| Rule | Source | How the generator applies it |
|---|---|---|
| A4, printed on one side, legible | Magistrates' Courts Rule 63 ("printed or typewritten … on one side only of paper of good quality and of A4 standard size"); Uniform Rule 62 (filing and preparation of documents) | A4 pages; 12 pt, 1.5 spacing and a 35 mm left (binding) margin for court documents |
| Consecutively numbered paragraphs | Uniform Rule 18 (pleadings); Rule 62; affidavit practice | `para` blocks are numbered through the document |
| Court heading: court, division, case number, parties and their roles | Forms in the First Schedule to the Uniform Rules (e.g. Form 2(a)) | `CourtHeading` on court documents |
| Pagination and indexing on CaseLines | Gauteng Consolidated Practice Directive 1 of 2024 para 7; Gauteng directive on indexing and pagination of bundles (2025) | Page numbers in the footer; the notice of motion check reminds the drafter of the division's directive |
| Affidavit: oath or affirmation; signed in the commissioner's presence; the commissioner's certificate; no commissioner with an interest | GN R1258 of 21 July 1972, regs 1–4 and 7(1) (draft 2026 regulations for virtual commissioning are out for comment) | Standard certificate block; checks note reg 3(1) and 7(1) |
| Amounts in words and figures | Practice; Deeds Registries Regulation 29 for property extents | Amounts are always written as "R12 500.00 (twelve thousand five hundred rand)" from a single value, so the words and figures can't disagree |

## House style (decided 17 November 2026)

The owner left the house style to the project; these defaults apply to every standard template until a firm sets its own (firm variants, later):

| Kind | Font | Spacing | Margins | Other |
|---|---|---|---|---|
| Court documents | Arial 12 pt | 1.5 | 25 mm, 35 mm left for binding | Numbered paragraphs, page numbers, court heading |
| Letters | Arial 11 pt | 1.15 | 25 mm | Firm letterhead, numbered paragraphs, page numbers |
| Agreements, wills, deeds and notices | Arial 11 pt | 1.3 | 25 mm | Numbered clauses, page numbers |

Why: 12 pt with 1.5 spacing on A4 is what the Uniform Rules (rule 62) and the Magistrates' Courts Rules (rule 63) ask for in substance (legible, A4, one side) and what divisional directives expect for papers and heads; the wider left margin leaves room to bind and paginate the court file. Letters and agreements are not filed, so 11 pt keeps them shorter without losing legibility. Arial (Helvetica in PDFs, which has the same metrics) reads well on screen and in CaseLines. Amounts are written in figures and words from one value, and dates are written out.

## Review of the standard wording

Dumisani Lukhele (admitted attorney) reviews every template. He records his decisions in the **Drafting templates: review tracker** Sheet (claude.ai artifact, one row per template, with a "How to review" tab), testing each template in the app on a test matter with a fictitious client.

- **Approved:** the template's `review` becomes `{ status: 'reviewed', by: 'Dumisani Lukhele', on: <date> }`.
- **Changes requested:** the wording or checks are changed as he specifies, the `version` is raised, the new version is written in the tracker's *Applied in version* column and the row is set to *Changes applied* for him to re-check.
- A later change to an approved template's wording goes back to him before release.

## Statutory rules built into the checks

| Template | Check | Source |
|---|---|---|
| Section 129 notice | Earliest enforcement date: 10 business days after delivery, and 20 business days in default; keep proof of delivery | National Credit Act ss 129(1)(a), 130(1); *Sebola* [2012] ZACC 11; *Kubyana* [2014] ZACC 1 |
| Section 3 notice | Served within six months of the debt becoming due, otherwise condonation; process only 30 days after service | Act 40 of 2002 ss 3(2)(a), 3(4), 5(2) |
| Letter of demand | Flags credit agreements (send the section 129 notice), organs of state (section 3 notice) and prescription (a demand doesn't interrupt it) | NCA s 129; Act 40 of 2002 s 3; Prescription Act ss 11, 14, 15 |
| Notice of motion | Notice of intention to oppose: not less than 5 days; answering affidavits: 15 days; the hearing must be on a court day; a prayer for costs | Uniform Rule 6(5)(b)(iii), 6(5)(d)(ii) |
| Will | A witness, or the spouse of a witness, who benefits is disqualified; signing formalities; a guardian can be appointed only by a sole guardian | Wills Act ss 2(1)(a), 4A; Children's Act s 27 |
| Mandate and fee agreement | Cost estimate when instructions are received; no-win-no-fee only under the Contingency Fees Act | Legal Practice Act s 35(7); Contingency Fees Act ss 2, 3 |
| Founding affidavit | Urgent applications must say why they are urgent and why redress in due course is not enough; annexures referred to (FA1…) must be listed; note on authority to bring the application | Uniform Rules 6(1), 6(12)(b), 7(1); *Ganes v Telecom Namibia* 2004 (3) SA 615 (SCA) |
| Confirmatory affidavit | Made by someone other than the main deponent | GN R1258 of 1972; practice |
| Combined summons | At least 10 court days to defend; contracts: written or oral, when, where and by whom, written copy annexed as POC1; damages itemised; Rule 41A notice; simple summons and magistrates' court jurisdiction considered | Uniform Rules 17, 18(6), 18(10), 19(1), 41A(2)(a) |
| Notice of intention to defend | Last day: 10 court days after service, not counting 16 December to 15 January; a late notice is still valid before default judgment (costs risk) | Uniform Rules 19(1), 19(5) |
| Plea | Every paragraph of the particulars answered (otherwise deemed admitted); "noted" flagged; last day 20 court days after the notice to defend | Uniform Rules 22(1)–(3), 26 |
| CCMA referral (Form 7.11) | 30 days for dismissals, 90 for unfair labour practices (Interpretation Act counting); a late referral gets a condonation application; service on the employer | LRA s 191(1), (2); CCMA Rules |
| Residential lease | Deposit in an interest-bearing account; joint inspections; refunds within 7, 14 or 21 days; consumer fixed-term leases over 24 months; 20 business days' cancellation and the 40–80 business day notice; agent's disclosure form | Rental Housing Act s 5(3); CPA s 14, reg 5; Property Practitioners Act ss 67, 70 |
| Deed of sale | Spouse's consent (in community); bond condition needs an amount and a date; instalment sales (Chapter II) flagged; five-day cooling-off clause added for natural persons at R250 000 or less; electrical certificate; agent's disclosure form and Fidelity Fund certificate | Alienation of Land Act ss 2(1), 29A, Ch II; Matrimonial Property Act s 15(2)(a), (5); PPA ss 47, 67, 70 |
| Power of attorney to pass transfer | Title deed number required and in the usual form; signed after the sale; spouse's assistance | Deeds Registries Act s 20; reg 44A; MPA s 15 |
| Acknowledgment of debt | Instalment needed; interest for a natural person may bring in the National Credit Act; section 58 consent to judgment | Prescription Act s 14; MCA s 58; NCA ss 8, 40, 101 |
| Suretyship | The secured debt identifiable from the deed; spouse's written consent (in community); unlimited liability flagged | General Law Amendment Act s 6; MPA s 15(2)(h), (5); NCA ss 4(2)(c), 8(5) |
| Contingency fees agreement | Success fee at most 100% above normal fees, and at most 25% of a money award; 14-day cooling-off; settlement only with consent; compare with the prescribed form | Contingency Fees Act ss 2(2), 3, 4, 5 |
| Answering affidavit | Every founding paragraph answered; bare denials flagged (no genuine dispute of fact); last day 15 court days after the notice to oppose | Uniform Rule 6(5)(d)(ii); *Plascon-Evans* 1984 (3) SA 623 (A); *Wightman* 2008 (3) SA 371 (SCA) |
| Replying affidavit | Last day 10 court days after the answer; no new case in reply | Uniform Rules 6(5)(e), 6(15); *Mistry* 1979 (1) SA 626 (A) |
| Simple summons | At least 10 court days to defend; a concise cause of action; only for a debt or liquidated demand | Uniform Rules 17(2)(b), 19(1), 20(1), 32 |
| Notice of bar | Only once the time for the pleading has expired; not needed for a replication | Uniform Rule 26 |
| Rule 41A notice | Agrees or opposes, with reasons; who serves it when | Uniform Rule 41A(2) |
| Without-prejudice offer | Something must be offered; the privilege covers only genuine settlement attempts, not admissions of insolvency; Rule 34 once proceedings have begun | *Naidoo* 1978 (3) SA 666 (A); *KLD Residential* 2017 (6) SA 55 (SCA); Uniform Rule 34 |
| Notice of breach | 20 business days to remedy for fixed-term consumer agreements; without a breach clause, material breach or a reasonable notice making time of the essence | CPA s 14(2)(b)(ii); common law |
| Request for arbitration (7.13) | Within 90 days of the certificate, otherwise condonation; without a certificate, only after 30 days; retrenchment and automatically unfair dismissals go to the Labour Court | LRA ss 136(1), 191(5), (12) |
| Employment contract | Ordinary hours at most 45 a week; overtime at least 1.5×; annual leave at least 15 working days (18 for a six-day week); BCEA notice periods; fixed terms over three months need a reason; restraints must be reasonable; minimum wage | BCEA ss 9, 10, 20, 22, 29, 37; LRA s 198B; *Magna Alloys* 1984 (4) SA 874 (A) |
| General power of attorney | Land needs a special power of attorney; ends on mental incapacity | Common law; Deeds Registries Act s 20 |
| Ex parte and urgent notices of motion | Hearing on a court day; why no notice is given; interim relief needs a return date; urgency set out in the founding affidavit | Uniform Rules 6(4), 6(12); *Schlesinger* 1979 (4) SA 342 (W) |
| Exception; Rule 30 notice | Notice to remove the cause of complaint (15 days) before a vague-and-embarrassing exception; Rule 30 notice within 10 days of becoming aware | Uniform Rules 23(1)(a), 30(2)(b) |
| Discovery affidavit | Ground of privilege for each part 2 document; within 20 days of the notice | Uniform Rule 35 |
| Heads of argument; draft order | Full citations for every authority; counsel's scale (A, B or C) in costs orders | Practice directives; Uniform Rule 67A(3) |
| Index to the papers | Page ranges computed in order | Gauteng indexing and pagination directive (2025) |
| Leave to appeal (civil) | Within 15 days; "would" have reasonable prospects; petition within a month of refusal | Superior Courts Act s 17; Uniform Rule 49(1)(b) |
| Settlement made an order of court | Relates to the issues, competent, enforceable | *Eke v Parsons* 2016 (3) SA 37 (CC) |
| Magistrates' Court summons, application, plea | At least 10 days to defend or oppose; NCA s 129/130 allegations on credit agreements; plea answers every paragraph within 20 days | MC Rules 13, 17, 55; NCA ss 129, 130 |
| Section 65A notice | Registered letter first where judgment was not given in the debtor's presence; personal service | MCA ss 65A, 65D |
| Bail affidavit | Schedule 6 exceptional circumstances; disclosure of previous convictions and pending charges | CPA s 60(11), (11B) |
| Section 112(2) statement; criminal appeal | Fault element stated; leave to appeal within 14 days of sentence | CPA ss 112(2), 309B, 316 |
| Condonation; Labour Court statement of claim | The whole delay explained; 90 days from the certificate | *Melane v Santam* 1962 (4) SA 531 (A); LRA s 191(11) |
| Disciplinary notice and outcome; s 189(3) notice | Time to prepare; findings and sanction; 30-day referral right; s 189(3) disclosures; severance at least one week per year; s 189A thresholds counting the last 12 months | Code of Good Practice: Dismissal (2023); LRA ss 189, 189A; BCEA s 41 |
| Divorce summons, settlement, parenting plan | Children's arrangements (s 6, Family Advocate); pension orders naming the fund and share; the child's views; jurisdiction | Divorce Act ss 2, 6, 7(8), 9; PFA s 37D(4); Children's Act ss 10, 31, 33, 34 |
| Antenuptial contract; maintenance complaint | Accrual starting values; notarial execution and registration within three months; needs totalled | MPA ss 6, 21; DRA s 87; Maintenance Act ss 6, 15 |
| Deed of transfer, mortgage bond, servitude, commercial lease | Extent in words and figures; title deed format; power of attorney after the sale; dominant tenement and SG diagram; leases of ten years or more registered | DRA ss 15, 20, 50, 65; reg 29; Act 18 of 1969 s 1 |
| Codicil, estate reporting, L&D account | Benefiting witnesses; 14 days to report; small estates (s 18(3)); heirs' shares total 100%; executor's fee at most 3.5% | Wills Act ss 2, 4A; AEA ss 7, 18(3), 35, 51; reg 8 |
| Company resolution, shareholders' agreement, cession, NDA, service agreement | Special-resolution matters; s 60 / s 74 written resolutions; consistency with the MOI; secured debt identified; POPIA operator terms; CPA unfair terms | Companies Act ss 15(7), 60, 65, 74; POPIA ss 19–21; CPA ss 48–51 |
| Statement of account, bill of costs, file note, reporting letter | Totals and VAT computed; 6-minute units; costs against the estimate | LPA s 35; Uniform Rule 70; VAT Act s 7 |
| Every template | Required fields; valid SA ID numbers (date and Luhn check digit); real dates; Rand amounts | — |

Business and court days skip weekends and public holidays, and for a notice of intention to defend also 16 December to 15 January. Calendar-day periods (for example LRA referrals) follow the Interpretation Act 33 of 1957 s 4: the first day is left out, and a last day on a Sunday or public holiday moves to the next day. Public holidays follow the Public Holidays Act 36 of 1994 (Good Friday and Family Day computed from Easter, and a holiday that falls on a Sunday moves to the Monday).

## Catalogue

The catalogue has 12 categories: correspondence, engagement, High Court, Magistrates' Courts, affidavits, labour, criminal, family, property, estates, commercial and practice. Each entry gives its purpose, forum and legal basis. Kinds without a template (none at present; new kinds can be added) show as *planned*.

**Every kind in the catalogue has a standard template (78).** The first 77 were written in seven batches (PRs #62–#72) and **approved for use by Dumisani Lukhele (admitted attorney) on 17 November 2026**; each now carries `review: { status: 'reviewed', by: 'Dumisani Lukhele', on: '2026-11-17' }`. The legal memorandum was added after his review and is *unreviewed* until he signs it off.

His recommendation, built into the app: **the attorney drafting each document remains responsible for checking its grammar, its wording and every input against the matter.** Every draft shows that note, and finalising a draft requires the attorney to confirm, by ticking a box, that they have done so (the API refuses to finalise without it).

## Adding a template

1. Write it in `apps/api/src/drafting/templates/`, with its `basis`, sections and fields (use `prefill` for what the matter already knows), `build` and `checks`.
2. Register it in `apps/api/src/drafting/registry.ts`, and set `availability: 'template'` for its catalogue entry.
3. Add tests for its checks.
4. When an attorney has reviewed the wording, set `review: { status: 'reviewed', by, on }` and bump the `version`. Drafts keep the version they were made from.

Later (production): firms upload their own reference documents to make firm variants, with their clauses and house style. The platform's statutory checks still run on them.
