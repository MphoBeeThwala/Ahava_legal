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
| Every template | Required fields; valid SA ID numbers (date and Luhn check digit); real dates; Rand amounts | — |

Business and court days skip weekends and public holidays, and for a notice of intention to defend also 16 December to 15 January. Calendar-day periods (for example LRA referrals) follow the Interpretation Act 33 of 1957 s 4: the first day is left out, and a last day on a Sunday or public holiday moves to the next day. Public holidays follow the Public Holidays Act 36 of 1994 (Good Friday and Family Day computed from Easter, and a holiday that falls on a Sunday moves to the Monday).

## Catalogue

The catalogue has 12 categories: correspondence, engagement, High Court, Magistrates' Courts, affidavits, labour, criminal, family, property, estates, commercial and practice. Each entry gives its purpose, forum and legal basis. Kinds without a template show as *planned*.

**Templates written so far (20):** letter of demand, section 129 notice, section 3 notice, affidavit, notice of motion, special power of attorney, mandate and fee agreement, last will; and in the second batch: founding and confirmatory affidavits, combined summons, notice of intention to defend, plea, CCMA referral (with condonation), residential lease, deed of sale, power of attorney to pass transfer, acknowledgment of debt, suretyship and contingency fees agreement.

**Suggested next batch:** answering and replying affidavits, simple summons, notice of bar, Rule 41A notice, without-prejudice offer, notice of breach, request for arbitration (LRA 7.13), employment contract and general power of attorney.

## Adding a template

1. Write it in `apps/api/src/drafting/templates/`, with its `basis`, sections and fields (use `prefill` for what the matter already knows), `build` and `checks`.
2. Register it in `apps/api/src/drafting/registry.ts`, and set `availability: 'template'` for its catalogue entry.
3. Add tests for its checks.
4. When an attorney has reviewed the wording, set `review: { status: 'reviewed', by, on }` and bump the `version`. Drafts keep the version they were made from.

Later (production): firms upload their own reference documents to make firm variants, with their clauses and house style. The platform's statutory checks still run on them.
