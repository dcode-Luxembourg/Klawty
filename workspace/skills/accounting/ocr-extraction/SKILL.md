---
name: ocr-extraction
description: "Extract structured data from scanned invoices, receipts, and financial documents"
metadata:
  klawty:
    emoji: "🔎"
---

# OCR Extraction

Processes scanned or photographed financial documents — invoices, receipts, credit notes, bank statements — and extracts structured data fields. Handles the messy reality of European invoice formats: multiple languages, varying layouts, handwritten notes, and inconsistent field placement.

## Musts

- Never mark an extraction as "verified" if confidence is below 85% on any critical field (amount, VAT number, date, supplier name).
- Always extract and validate the VAT identification number (format: LU + 8 digits for Luxembourg) against the VIES database.
- Never discard the original document after extraction — retain the source file linked to the extracted record.
- Flag any document where the extracted total does not match the sum of line items + VAT.

## Guidelines

- Process documents in priority order: invoices with approaching payment deadlines first, then receipts, then statements.
- For multi-page invoices, verify page count matches and no pages are missing (check "page X of Y" markers).
- Common extraction fields: invoice number, date, due date, supplier name, VAT number, line items, net amount, VAT amount, total, currency, IBAN.
- Handle both comma-decimal (European: 1.234,56) and dot-decimal (Anglo: 1,234.56) number formats based on document origin.
- When OCR returns ambiguous characters (0/O, 1/l, 5/S), cross-reference against known supplier data.

## Common Actions

### Extract invoice data

When a new document arrives, call `extract_document` with the file path. Review the extraction result — if all fields pass confidence threshold, call `create_invoice_record`. If any field is low-confidence, flag for manual review with the specific ambiguous fields highlighted.

### Batch processing

For bulk document intake (monthly box of receipts), call `batch_extract` with the folder path. Generate a processing report showing: documents processed, auto-verified count, flagged-for-review count, and failed extractions. Prioritize review queue by amount.

### Validate extracted data

After extraction, call `validate_vat_number` against VIES, `check_duplicate_invoice` against existing records, and `verify_arithmetic` to confirm line items sum correctly. Log validation results per document.
