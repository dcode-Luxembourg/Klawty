---
name: legal-document-templates
description: "Generate structured legal document drafts from templates with proper Luxembourg formalities"
metadata:
  klawty:
    emoji: "📄"
---

# Legal Document Templates

Produces first-draft legal documents from structured templates — contracts, letters, corporate resolutions, powers of attorney, and standard agreements. All templates follow Luxembourg legal formalities and conventions, ready for lawyer review and customization.

## Musts

- Never present a template output as a final legal document — always mark as "DRAFT — for lawyer review" with a watermark or header.
- Always include the correct formalities for the document type: notarial acts require specific language, board resolutions require quorum references, contracts require capacity statements.
- Never leave placeholder fields unfilled without flagging them — every [PLACEHOLDER] must be listed in a cover note.
- Use the correct legal entity designation (SARL, SA, SCS) with full registered details (RCS number, registered office, represented by).

## Guidelines

- Luxembourg corporate resolutions must reference the articles of association (statuts coordonnes) and the applicable Companies Law (Loi du 10 aout 1915).
- Powers of attorney (procurations) should specify scope precisely — general powers are disfavored in Luxembourg practice.
- For bilingual documents (FR/EN or FR/DE), specify which language prevails in case of conflict.
- Include standard boilerplate appropriate to Luxembourg: severability, entire agreement, notices, amendments in writing.
- Reference the correct registration requirements: some documents must be filed with the RCSL (Registre de Commerce) or published in the RESA (Recueil Electronique des Societes et Associations).

## Common Actions

### Generate a contract draft

Call `generate_template` with document type (service agreement, NDA, employment contract, shareholders agreement), parties, and key terms. Produce a structured draft with proper Luxembourg formalities, defined terms, and flagged decision points where the lawyer must choose between options.

### Produce corporate resolutions

Call `generate_resolution` with resolution type (board, shareholders, written circular), company details, and agenda items. Include quorum verification, voting requirements per the statuts, and RCSL filing requirements if applicable.

### Create a power of attorney

Call `generate_procuration` with grantor, grantee, scope, duration, and any restrictions. Follow Luxembourg notarial conventions if the POA requires notarization (e.g., for real estate transactions).
