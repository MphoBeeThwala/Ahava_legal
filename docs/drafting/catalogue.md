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
| Every template | Required fields; valid SA ID numbers (date and Luhn check digit); real dates; Rand amounts | — |

Business and court days skip weekends and public holidays (Public Holidays Act 36 of 1994: Good Friday and Family Day computed from Easter, and a holiday that falls on a Sunday moves to the Monday).

## Catalogue

The catalogue has 12 categories: correspondence, engagement, High Court, Magistrates' Courts, affidavits, labour, criminal, family, property, estates, commercial and practice. Each entry gives its purpose, forum and legal basis. Kinds without a template show as *planned*.

**Next templates to write (suggested order):**
1. Founding and confirmatory affidavits
2. Combined summons with particulars of claim
3. Notice of intention to defend and plea
4. CCMA referral pack (LRA 7.11, with the condonation affidavit)
5. Residential lease (Rental Housing Act s 5)
6. Deed of sale (Alienation of Land Act s 2(1))
7. Acknowledgment of debt
8. Suretyship (General Law Amendment Act s 6)
9. Power of attorney to pass transfer (Deeds Registries Act s 20; Regulations 44, 44A)
10. Contingency fees agreement in the prescribed form

## Adding a template

1. Write it in `apps/api/src/drafting/templates/`, with its `basis`, sections and fields (use `prefill` for what the matter already knows), `build` and `checks`.
2. Register it in `apps/api/src/drafting/registry.ts`, and set `availability: 'template'` for its catalogue entry.
3. Add tests for its checks.
4. When an attorney has reviewed the wording, set `review: { status: 'reviewed', by, on }` and bump the `version`. Drafts keep the version they were made from.

Later (production): firms upload their own reference documents to make firm variants, with their clauses and house style. The platform's statutory checks still run on them.
