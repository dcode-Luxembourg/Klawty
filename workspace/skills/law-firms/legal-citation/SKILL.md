---
name: legal-citation
description: "Format legal citations correctly for Luxembourg courts, EU institutions, and academic publications"
metadata:
  klawty:
    emoji: "📎"
---

# Legal Citation

Formats legal references — case law, legislation, doctrine, and regulatory instruments — according to Luxembourg legal citation conventions. Correct citation is not decorative; it determines whether a court can locate and verify the authority cited.

## Musts

- Always cite the official source when available: Memorial for legislation, Pasicrisie for case law, EUR-Lex for EU law.
- Never abbreviate a court name on first reference — write "Cour Superieure de Justice" first, then "CSJ" thereafter.
- Always include the decision date and case number for court decisions — the date alone is insufficient when multiple decisions are issued the same day.
- For EU case law, use the ECLI (European Case Law Identifier) format alongside the traditional C-xxx/xx numbering.

## Guidelines

- Luxembourg case citation format: Court, date, case number, publication (e.g., "Trib. arr. Luxembourg, 15 mars 2024, no 2023/0456, JurisNews").
- Luxembourg legislation format: "Loi du [date] [subject], Memorial A no [number] du [date]" (e.g., "Loi du 10 aout 1915 concernant les societes commerciales, Memorial A no 90").
- EU legislation: "Reglement (UE) 2016/679 du Parlement europeen et du Conseil du 27 avril 2016" (GDPR), then "Reglement (UE) 2016/679" on subsequent references.
- CJEU cases: "CJUE, arret du [date], [case name], aff. C-[number], ECLI:EU:C:[year]:[number]".
- Doctrine: Author, "Title," Publication, Year, page (e.g., 'Ravarani G., "La responsabilite civile des personnes privees et publiques," Pasicrisie, 2014, p. 234').

## Common Actions

### Format a citation

Call `format_citation` with the raw reference details (court, date, number, source). Return the properly formatted citation in Luxembourg convention. Handle legislation, case law, EU instruments, and doctrine formats.

### Verify a citation

Call `verify_citation` to confirm the referenced authority exists, is correctly attributed, and has not been overturned. Flag any citation errors (wrong date, wrong case number, wrong publication reference).

### Generate a bibliography

Call `compile_bibliography` for a legal memorandum or brief. Organize references by type (legislation, case law, doctrine) in standard Luxembourg format. Remove duplicates and ensure consistent formatting.
