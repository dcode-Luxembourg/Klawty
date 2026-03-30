"use strict";

const { ensureVerticalSchema } = require("./vertical-db-schema");

let _schemaReady = false;

function _ensureSchema(db) {
  if (!_schemaReady) {
    ensureVerticalSchema(db, "accounting");
    _schemaReady = true;
  }
}

// ─── Comptable (9 tools) ────────────────────────────────────────────

const scan_inbox_documents = {
  riskLevel: "auto",
  description: "Scan inbox for pending documents and return status summary",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const total = db.prepare(`SELECT COUNT(*) as count FROM documents`).get();
    const byStatus = db
      .prepare(`SELECT status, COUNT(*) as count FROM documents GROUP BY status`)
      .all();
    const byType = db.prepare(`SELECT type, COUNT(*) as count FROM documents GROUP BY type`).all();
    const pending = db
      .prepare(
        `SELECT id, type, vendor, invoice_number, amount_ttc, created_at FROM documents WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20`,
      )
      .all();
    return {
      total: total.count,
      by_status: byStatus,
      by_type: byType,
      pending_documents: pending,
      scanned_at: new Date().toISOString(),
    };
  },
};

const classify_receipt = {
  riskLevel: "auto+",
  description: "Classify a document by type and assign confidence score",
  isWriteTool: true,
  execute: async (params, context) => {
    const { doc_id } = params;
    if (!doc_id) return { error: "doc_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);
    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(doc_id);
    if (!doc) return { error: `Document ${doc_id} not found` };

    // Determine type based on available data
    let type = "other";
    let confidence = 0.5;
    if (doc.invoice_number) {
      type = "invoice";
      confidence = 0.9;
    } else if (doc.amount_htva && doc.vat_amount) {
      type = "expense";
      confidence = 0.75;
    } else if (doc.vendor && doc.amount_ttc) {
      type = "invoice";
      confidence = 0.7;
    }

    db.prepare(
      `UPDATE documents SET type = ?, confidence_score = ?, status = 'classified' WHERE id = ?`,
    ).run(type, confidence, doc_id);
    return { doc_id, type, confidence, status: "classified" };
  },
};

const extract_invoice_data = {
  riskLevel: "auto",
  description: "Extract structured data from a document",
  isWriteTool: false,
  execute: async (params, context) => {
    const { doc_id } = params;
    if (!doc_id) return { error: "doc_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);
    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(doc_id);
    if (!doc) return { error: `Document ${doc_id} not found` };
    return {
      doc_id: doc.id,
      type: doc.type,
      vendor: doc.vendor,
      invoice_number: doc.invoice_number,
      date: doc.date,
      amount_htva: doc.amount_htva,
      vat_amount: doc.vat_amount,
      amount_ttc: doc.amount_ttc,
      vat_rate: doc.vat_rate,
      currency: doc.currency,
      client_id: doc.client_id,
      source_file: doc.source_file,
      status: doc.status,
      confidence_score: doc.confidence_score,
    };
  },
};

const detect_duplicate_invoice = {
  riskLevel: "auto",
  description: "Detect potential duplicate invoices by vendor, invoice number, and amount",
  isWriteTool: false,
  execute: async (params, context) => {
    const { vendor, invoice_number, amount } = params;
    if (!vendor && !invoice_number && !amount)
      return { error: "At least one of vendor, invoice_number, or amount is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const conditions = [];
    const values = [];
    if (vendor) {
      conditions.push(`vendor = ?`);
      values.push(vendor);
    }
    if (invoice_number) {
      conditions.push(`invoice_number = ?`);
      values.push(invoice_number);
    }
    if (amount) {
      conditions.push(`amount_ttc = ?`);
      values.push(amount);
    }

    const sql = `SELECT id, type, vendor, invoice_number, amount_ttc, date, status FROM documents WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`;
    const matches = db.prepare(sql).all(...values);
    return {
      duplicate_found: matches.length > 1,
      match_count: matches.length,
      matches,
      criteria: { vendor, invoice_number, amount },
    };
  },
};

const lookup_vendor = {
  riskLevel: "auto",
  description: "Look up a vendor by name or VAT number",
  isWriteTool: false,
  execute: async (params, context) => {
    const { name_or_vat } = params;
    if (!name_or_vat) return { error: "name_or_vat is required" };
    const db = context.getDatabase();
    _ensureSchema(db);
    const results = db
      .prepare(`SELECT * FROM vendors WHERE name LIKE ? OR vat_number LIKE ?`)
      .all(`%${name_or_vat}%`, `%${name_or_vat}%`);
    return { count: results.length, vendors: results };
  },
};

const draft_journal_entry = {
  riskLevel: "auto+",
  description: "Create a draft journal entry for a document",
  isWriteTool: true,
  execute: async (params, context) => {
    const { doc_id, debit, credit, amount, vat_code, cost_center } = params;
    if (!doc_id || !debit || !credit || !amount)
      return { error: "doc_id, debit, credit, and amount are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(doc_id);
    if (!doc) return { error: `Document ${doc_id} not found` };

    const result = db
      .prepare(
        `INSERT INTO journal_entries (document_id, debit_account, credit_account, amount, vat_code, cost_center, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
      )
      .run(
        doc_id,
        debit,
        credit,
        amount,
        vat_code || null,
        cost_center || null,
        `Entry for ${doc.type} ${doc.invoice_number || ""} from ${doc.vendor || "unknown"}`,
      );

    return {
      entry_id: result.lastInsertRowid,
      doc_id,
      debit,
      credit,
      amount,
      vat_code,
      cost_center,
      status: "draft",
    };
  },
};

const attach_source_document = {
  riskLevel: "auto+",
  description: "Attach a source file path to a document record",
  isWriteTool: true,
  execute: async (params, context) => {
    const { entry_id, file_path } = params;
    if (!entry_id || !file_path) return { error: "entry_id and file_path are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const entry = db.prepare(`SELECT document_id FROM journal_entries WHERE id = ?`).get(entry_id);
    if (!entry) return { error: `Journal entry ${entry_id} not found` };

    db.prepare(`UPDATE documents SET source_file = ? WHERE id = ?`).run(
      file_path,
      entry.document_id,
    );
    return { entry_id, document_id: entry.document_id, file_path, attached: true };
  },
};

const submit_entry_for_review = {
  riskLevel: "propose",
  description: "Submit a draft journal entry for review",
  isWriteTool: true,
  execute: async (params, context) => {
    const { entry_id } = params;
    if (!entry_id) return { error: "entry_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const entry = db.prepare(`SELECT * FROM journal_entries WHERE id = ?`).get(entry_id);
    if (!entry) return { error: `Journal entry ${entry_id} not found` };
    if (entry.status !== "draft")
      return { error: `Entry ${entry_id} is ${entry.status}, not draft` };

    db.prepare(
      `UPDATE journal_entries SET status = 'reviewed', reviewed_at = datetime('now') WHERE id = ?`,
    ).run(entry_id);
    return { entry_id, previous_status: "draft", new_status: "reviewed" };
  },
};

const flag_vendor_anomaly = {
  riskLevel: "auto",
  description: "Flag an anomaly detected for a vendor",
  isWriteTool: false,
  execute: async (params, context) => {
    const { vendor_id, anomaly_type, details } = params;
    if (!vendor_id || !anomaly_type) return { error: "vendor_id and anomaly_type are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const vendor = db.prepare(`SELECT * FROM vendors WHERE id = ?`).get(vendor_id);
    if (!vendor) return { error: `Vendor ${vendor_id} not found` };

    return {
      alert: true,
      vendor_id,
      vendor_name: vendor.name,
      anomaly_type,
      details: details || null,
      flagged_at: new Date().toISOString(),
    };
  },
};

// ─── Echeancier (8 tools) ───────────────────────────────────────────

const scan_compliance_calendar = {
  riskLevel: "auto",
  description: "Scan upcoming compliance deadlines within a given window",
  isWriteTool: false,
  execute: async (params, context) => {
    const { days } = params;
    const window = days || 30;
    const db = context.getDatabase();
    _ensureSchema(db);
    const deadlines = db
      .prepare(
        `SELECT * FROM deadlines WHERE due_date <= date('now', '+' || ? || ' days') AND status NOT IN ('filed') ORDER BY due_date ASC`,
      )
      .all(window);
    return { window_days: window, count: deadlines.length, deadlines };
  },
};

const check_vat_deadline = {
  riskLevel: "auto",
  description: "Check VAT filing deadlines for a specific period",
  isWriteTool: false,
  execute: async (params, context) => {
    const { period } = params;
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql = `SELECT * FROM deadlines WHERE type = 'VAT'`;
    const values = [];
    if (period) {
      sql += ` AND filing_period = ?`;
      values.push(period);
    }
    sql += ` ORDER BY due_date ASC`;
    const deadlines = db.prepare(sql).all(...values);
    return { type: "VAT", period: period || "all", count: deadlines.length, deadlines };
  },
};

const check_tax_filing_status = {
  riskLevel: "auto",
  description: "Check tax filing status for a client or filing type",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id, type } = params;
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql = `SELECT * FROM deadlines WHERE 1=1`;
    const values = [];
    if (client_id) {
      sql += ` AND client_id = ?`;
      values.push(client_id);
    }
    if (type) {
      sql += ` AND type = ?`;
      values.push(type);
    }
    sql += ` ORDER BY due_date ASC`;
    const deadlines = db.prepare(sql).all(...values);
    return {
      client_id: client_id || "all",
      type: type || "all",
      count: deadlines.length,
      deadlines,
    };
  },
};

const create_document_request = {
  riskLevel: "auto+",
  description: "Create document request entries for a client onboarding checklist",
  isWriteTool: true,
  execute: async (params, context) => {
    const { client_id, items } = params;
    if (!client_id || !items || !Array.isArray(items) || items.length === 0) {
      return { error: "client_id and items (array) are required" };
    }
    const db = context.getDatabase();
    _ensureSchema(db);

    const insert = db.prepare(
      `INSERT INTO client_onboarding (client_id, client_name, item, status, requested_at) VALUES (?, ?, ?, 'requested', datetime('now'))`,
    );
    const transaction = db.transaction(() => {
      const created = [];
      for (const item of items) {
        const result = insert.run(client_id, client_id, item);
        created.push({ id: result.lastInsertRowid, item });
      }
      return created;
    });
    const created = transaction();
    return { client_id, items_created: created.length, entries: created };
  },
};

const schedule_reminder = {
  riskLevel: "auto+",
  description: "Set the reminder stage for a deadline",
  isWriteTool: true,
  execute: async (params, context) => {
    const { deadline_id, stages } = params;
    if (!deadline_id || stages === undefined)
      return { error: "deadline_id and stages are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const deadline = db.prepare(`SELECT * FROM deadlines WHERE id = ?`).get(deadline_id);
    if (!deadline) return { error: `Deadline ${deadline_id} not found` };

    db.prepare(`UPDATE deadlines SET reminder_stage = ? WHERE id = ?`).run(stages, deadline_id);
    return { deadline_id, previous_stage: deadline.reminder_stage, new_stage: stages };
  },
};

const escalate_overdue = {
  riskLevel: "propose",
  description: "Escalate an overdue deadline",
  isWriteTool: false,
  execute: async (params, context) => {
    const { deadline_id } = params;
    if (!deadline_id) return { error: "deadline_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const deadline = db.prepare(`SELECT * FROM deadlines WHERE id = ?`).get(deadline_id);
    if (!deadline) return { error: `Deadline ${deadline_id} not found` };

    return {
      escalation: true,
      deadline_id,
      client_id: deadline.client_id,
      type: deadline.type,
      due_date: deadline.due_date,
      status: deadline.status,
      days_overdue: Math.floor((Date.now() - new Date(deadline.due_date).getTime()) / 86400000),
      escalated_at: new Date().toISOString(),
    };
  },
};

const update_deadline_status = {
  riskLevel: "auto+",
  description: "Update the status of a deadline with optional evidence",
  isWriteTool: true,
  execute: async (params, context) => {
    const { deadline_id, status, evidence } = params;
    if (!deadline_id || !status) return { error: "deadline_id and status are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const deadline = db.prepare(`SELECT * FROM deadlines WHERE id = ?`).get(deadline_id);
    if (!deadline) return { error: `Deadline ${deadline_id} not found` };

    const validStatuses = ["upcoming", "at_risk", "filed", "overdue", "extended"];
    if (!validStatuses.includes(status))
      return { error: `Invalid status. Valid: ${validStatuses.join(", ")}` };

    let sql = `UPDATE deadlines SET status = ?`;
    const values = [status];
    if (evidence) {
      sql += `, description = COALESCE(description, '') || ' [Evidence: ' || ? || ']'`;
      values.push(evidence);
    }
    sql += ` WHERE id = ?`;
    values.push(deadline_id);
    db.prepare(sql).run(...values);

    return {
      deadline_id,
      previous_status: deadline.status,
      new_status: status,
      evidence: evidence || null,
    };
  },
};

const check_extension_eligibility = {
  riskLevel: "auto",
  description: "Assess whether a deadline is eligible for an extension",
  isWriteTool: false,
  execute: async (params, context) => {
    const { deadline_id } = params;
    if (!deadline_id) return { error: "deadline_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const deadline = db.prepare(`SELECT * FROM deadlines WHERE id = ?`).get(deadline_id);
    if (!deadline) return { error: `Deadline ${deadline_id} not found` };

    const dueDate = new Date(deadline.due_date);
    const now = new Date();
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / 86400000);
    const alreadyExtended = deadline.status === "extended";
    const eligible = !alreadyExtended && daysUntilDue > -30;

    return {
      deadline_id,
      type: deadline.type,
      due_date: deadline.due_date,
      days_until_due: daysUntilDue,
      already_extended: alreadyExtended,
      eligible,
      reason: alreadyExtended
        ? "Already extended once"
        : daysUntilDue <= -30
          ? "Too far past due date"
          : "Meets eligibility criteria",
      assessed_at: new Date().toISOString(),
    };
  },
};

// ─── Auditeur (8 tools) ─────────────────────────────────────────────

const review_journal_entry = {
  riskLevel: "auto",
  description: "Validate a journal entry: check GL codes, debit=credit balance, VAT consistency",
  isWriteTool: false,
  execute: async (params, context) => {
    const { entry_id } = params;
    if (!entry_id) return { error: "entry_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const entry = db.prepare(`SELECT * FROM journal_entries WHERE id = ?`).get(entry_id);
    if (!entry) return { error: `Journal entry ${entry_id} not found` };

    const issues = [];
    // Check GL code format (expecting digit-based codes)
    if (!entry.debit_account || !/^\d/.test(entry.debit_account))
      issues.push("Invalid debit account code");
    if (!entry.credit_account || !/^\d/.test(entry.credit_account))
      issues.push("Invalid credit account code");
    // Debit must equal credit (single entry — amount is same)
    if (entry.amount <= 0) issues.push("Amount must be positive");
    // VAT consistency
    if (entry.vat_code) {
      const doc = entry.document_id
        ? db.prepare(`SELECT * FROM documents WHERE id = ?`).get(entry.document_id)
        : null;
      if (doc && doc.vat_rate && entry.vat_code !== `V${doc.vat_rate}`) {
        issues.push(`VAT code ${entry.vat_code} may not match document VAT rate ${doc.vat_rate}%`);
      }
    }

    return {
      entry_id,
      status: entry.status,
      debit_account: entry.debit_account,
      credit_account: entry.credit_account,
      amount: entry.amount,
      vat_code: entry.vat_code,
      issues,
      valid: issues.length === 0,
      reviewed_at: new Date().toISOString(),
    };
  },
};

const reconcile_bank_statement = {
  riskLevel: "auto",
  description: "Retrieve reconciliation status and journal entries for a period",
  isWriteTool: false,
  execute: async (params, context) => {
    const { period } = params;
    if (!period) return { error: "period is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const recon = db.prepare(`SELECT * FROM reconciliation WHERE period = ?`).get(period);
    const entries = db
      .prepare(
        `SELECT je.*, d.vendor, d.invoice_number FROM journal_entries je
       LEFT JOIN documents d ON je.document_id = d.id
       WHERE je.created_at LIKE ? || '%'
       ORDER BY je.created_at`,
      )
      .all(period);

    return {
      period,
      reconciliation: recon || { status: "no_data", period },
      entries_count: entries.length,
      entries,
    };
  },
};

const detect_anomaly = {
  riskLevel: "auto",
  description: "Detect anomalies in journal entries: unusual amounts, duplicates, missing data",
  isWriteTool: false,
  execute: async (params, context) => {
    const { entry_id } = params;
    const db = context.getDatabase();
    _ensureSchema(db);

    const anomalies = [];

    if (entry_id) {
      const entry = db.prepare(`SELECT * FROM journal_entries WHERE id = ?`).get(entry_id);
      if (!entry) return { error: `Journal entry ${entry_id} not found` };

      // Check for unusually large amounts
      const avgResult = db
        .prepare(`SELECT AVG(amount) as avg_amount, MAX(amount) as max_amount FROM journal_entries`)
        .get();
      if (avgResult.avg_amount && entry.amount > avgResult.avg_amount * 5) {
        anomalies.push({
          type: "unusual_amount",
          entry_id,
          amount: entry.amount,
          avg: avgResult.avg_amount,
        });
      }
      // Check for duplicate entries
      const dupes = db
        .prepare(
          `SELECT id FROM journal_entries WHERE document_id = ? AND debit_account = ? AND credit_account = ? AND amount = ? AND id != ?`,
        )
        .all(entry.document_id, entry.debit_account, entry.credit_account, entry.amount, entry_id);
      if (dupes.length > 0) {
        anomalies.push({ type: "duplicate", entry_id, duplicate_ids: dupes.map((d) => d.id) });
      }
    } else {
      // Scan all: entries without documents
      const orphans = db
        .prepare(
          `SELECT id, amount FROM journal_entries WHERE document_id IS NULL OR document_id NOT IN (SELECT id FROM documents)`,
        )
        .all();
      if (orphans.length > 0) anomalies.push({ type: "missing_document", entries: orphans });

      // Entries with zero amount
      const zeros = db.prepare(`SELECT id FROM journal_entries WHERE amount = 0`).all();
      if (zeros.length > 0) anomalies.push({ type: "zero_amount", entries: zeros });
    }

    return {
      entry_id: entry_id || "all",
      anomaly_count: anomalies.length,
      anomalies,
      checked_at: new Date().toISOString(),
    };
  },
};

const check_missing_documents = {
  riskLevel: "auto",
  description: "Cross-reference deadlines against onboarding to find missing client documents",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id } = params;
    if (!client_id) return { error: "client_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const pending = db
      .prepare(
        `SELECT * FROM client_onboarding WHERE client_id = ? AND status IN ('pending', 'requested') ORDER BY requested_at`,
      )
      .all(client_id);

    const deadlines = db
      .prepare(
        `SELECT * FROM deadlines WHERE client_id = ? AND status IN ('upcoming', 'at_risk') ORDER BY due_date`,
      )
      .all(client_id);

    return {
      client_id,
      missing_documents: pending,
      missing_count: pending.length,
      upcoming_deadlines: deadlines,
      at_risk: deadlines.some((d) => d.status === "at_risk"),
    };
  },
};

const flag_exception = {
  riskLevel: "auto",
  description: "Flag an exception on a journal entry for review",
  isWriteTool: false,
  execute: async (params, context) => {
    const { entry_id, severity, description } = params;
    if (!entry_id || !severity) return { error: "entry_id and severity are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const entry = db.prepare(`SELECT * FROM journal_entries WHERE id = ?`).get(entry_id);
    if (!entry) return { error: `Journal entry ${entry_id} not found` };

    return {
      exception: true,
      entry_id,
      severity,
      description: description || null,
      entry_status: entry.status,
      amount: entry.amount,
      debit_account: entry.debit_account,
      credit_account: entry.credit_account,
      flagged_at: new Date().toISOString(),
    };
  },
};

const approve_draft_entry = {
  riskLevel: "propose",
  description: "Approve a draft journal entry for posting",
  isWriteTool: true,
  execute: async (params, context) => {
    const { entry_id } = params;
    if (!entry_id) return { error: "entry_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const entry = db.prepare(`SELECT * FROM journal_entries WHERE id = ?`).get(entry_id);
    if (!entry) return { error: `Journal entry ${entry_id} not found` };
    if (entry.status !== "reviewed")
      return { error: `Entry ${entry_id} is ${entry.status}, must be reviewed before approval` };

    db.prepare(
      `UPDATE journal_entries SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?`,
    ).run(entry_id);
    return { entry_id, previous_status: "reviewed", new_status: "approved" };
  },
};

const reject_draft_entry = {
  riskLevel: "auto+",
  description: "Reject a draft journal entry with a reason",
  isWriteTool: true,
  execute: async (params, context) => {
    const { entry_id, reason } = params;
    if (!entry_id || !reason) return { error: "entry_id and reason are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const entry = db.prepare(`SELECT * FROM journal_entries WHERE id = ?`).get(entry_id);
    if (!entry) return { error: `Journal entry ${entry_id} not found` };

    db.prepare(
      `UPDATE journal_entries SET status = 'rejected', rejection_reason = ?, reviewed_at = datetime('now') WHERE id = ?`,
    ).run(reason, entry_id);
    return { entry_id, previous_status: entry.status, new_status: "rejected", reason };
  },
};

const generate_reconciliation_report = {
  riskLevel: "auto",
  description: "Generate an aggregated reconciliation report for a period",
  isWriteTool: false,
  execute: async (params, context) => {
    const { period } = params;
    if (!period) return { error: "period is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const recon = db.prepare(`SELECT * FROM reconciliation WHERE period = ?`).get(period);
    const totals = db
      .prepare(
        `SELECT COUNT(*) as count, SUM(amount) as total_amount,
              SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount,
              SUM(CASE WHEN status = 'draft' THEN amount ELSE 0 END) as draft_amount
       FROM journal_entries WHERE created_at LIKE ? || '%'`,
      )
      .get(period);

    const byAccount = db
      .prepare(
        `SELECT debit_account, SUM(amount) as total FROM journal_entries WHERE created_at LIKE ? || '%' GROUP BY debit_account ORDER BY total DESC`,
      )
      .all(period);

    return {
      period,
      reconciliation: recon || null,
      journal_summary: totals,
      by_debit_account: byAccount,
      generated_at: new Date().toISOString(),
    };
  },
};

// ─── Relations (9 tools) ────────────────────────────────────────────

const scan_client_inbox = {
  riskLevel: "auto",
  description: "Scan client inbox for pending communications and document requests",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);

    const pendingRequests = db
      .prepare(
        `SELECT client_id, COUNT(*) as pending_count FROM client_onboarding WHERE status IN ('pending', 'requested') GROUP BY client_id`,
      )
      .all();

    const atRiskDeadlines = db
      .prepare(
        `SELECT client_id, COUNT(*) as count FROM deadlines WHERE status = 'at_risk' GROUP BY client_id`,
      )
      .all();

    return {
      clients_with_pending_requests: pendingRequests,
      clients_with_at_risk_deadlines: atRiskDeadlines,
      total_pending_clients: pendingRequests.length,
      scanned_at: new Date().toISOString(),
    };
  },
};

const draft_document_request_email = {
  riskLevel: "auto",
  description: "Draft an email requesting missing documents from a client",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id } = params;
    if (!client_id) return { error: "client_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const missing = db
      .prepare(
        `SELECT item, status FROM client_onboarding WHERE client_id = ? AND status IN ('pending', 'requested') ORDER BY item`,
      )
      .all(client_id);

    if (missing.length === 0)
      return { client_id, draft: null, message: "No missing documents for this client" };

    const itemList = missing.map((m) => `- ${m.item}`).join("\n");
    const draft = {
      to: client_id,
      subject: `Documents requis - ${client_id}`,
      body: `Bonjour,\n\nNous avons besoin des documents suivants pour compléter votre dossier:\n\n${itemList}\n\nMerci de nous les transmettre dans les meilleurs délais.\n\nCordialement`,
    };

    return { client_id, missing_count: missing.length, draft };
  },
};

const draft_status_digest = {
  riskLevel: "auto",
  description: "Aggregate filings and deadlines into a status digest for a client",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id } = params;
    if (!client_id) return { error: "client_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const deadlines = db
      .prepare(`SELECT * FROM deadlines WHERE client_id = ? ORDER BY due_date`)
      .all(client_id);
    const onboarding = db
      .prepare(`SELECT * FROM client_onboarding WHERE client_id = ?`)
      .all(client_id);
    const docs = db
      .prepare(
        `SELECT type, status, COUNT(*) as count FROM documents WHERE client_id = ? GROUP BY type, status`,
      )
      .all(client_id);

    const filed = deadlines.filter((d) => d.status === "filed").length;
    const upcoming = deadlines.filter((d) => d.status === "upcoming").length;
    const atRisk = deadlines.filter((d) => d.status === "at_risk").length;
    const overdue = deadlines.filter((d) => d.status === "overdue").length;

    return {
      client_id,
      summary: { filed, upcoming, at_risk: atRisk, overdue },
      deadlines,
      onboarding_status: onboarding,
      document_summary: docs,
      generated_at: new Date().toISOString(),
    };
  },
};

const send_client_email = {
  riskLevel: "confirm",
  description: "Send an email to a client (requires confirmation)",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id, subject, content } = params;
    if (!client_id || !subject || !content)
      return { error: "client_id, subject, and content are required" };

    return {
      confirmation_required: true,
      client_id,
      subject,
      content,
      prepared_at: new Date().toISOString(),
      message: "Email prepared for sending. Awaiting confirmation.",
    };
  },
};

const update_onboarding_checklist = {
  riskLevel: "auto+",
  description: "Update the status of a client onboarding checklist item",
  isWriteTool: true,
  execute: async (params, context) => {
    const { client_id, item, status } = params;
    if (!client_id || !item || !status)
      return { error: "client_id, item, and status are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const validStatuses = ["pending", "requested", "received", "verified"];
    if (!validStatuses.includes(status))
      return { error: `Invalid status. Valid: ${validStatuses.join(", ")}` };

    const existing = db
      .prepare(`SELECT * FROM client_onboarding WHERE client_id = ? AND item = ?`)
      .get(client_id, item);
    if (!existing) return { error: `Onboarding item '${item}' not found for client ${client_id}` };

    let sql = `UPDATE client_onboarding SET status = ?`;
    const values = [status];
    if (status === "received") {
      sql += `, received_at = datetime('now')`;
    }
    sql += ` WHERE client_id = ? AND item = ?`;
    values.push(client_id, item);
    db.prepare(sql).run(...values);

    return { client_id, item, previous_status: existing.status, new_status: status };
  },
};

const log_client_interaction = {
  riskLevel: "auto",
  description: "Log a client interaction (call, email, meeting)",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id, type, summary } = params;
    if (!client_id || !type || !summary)
      return { error: "client_id, type, and summary are required" };

    return {
      log_entry: true,
      client_id,
      type,
      summary,
      logged_at: new Date().toISOString(),
    };
  },
};

const create_satisfaction_survey = {
  riskLevel: "auto",
  description: "Create a client satisfaction survey draft",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id } = params;
    if (!client_id) return { error: "client_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const deadlines = db
      .prepare(`SELECT COUNT(*) as filed FROM deadlines WHERE client_id = ? AND status = 'filed'`)
      .get(client_id);

    return {
      client_id,
      survey_draft: {
        questions: [
          "How satisfied are you with our filing timeliness? (1-5)",
          "How would you rate our communication? (1-5)",
          "How clear are our document requests? (1-5)",
          "Would you recommend our services? (Yes/No)",
          "Any additional feedback?",
        ],
        context: { filings_completed: deadlines.filed },
      },
      created_at: new Date().toISOString(),
    };
  },
};

const check_client_response_status = {
  riskLevel: "auto",
  description: "Check pending document requests and client response status",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id } = params;
    if (!client_id) return { error: "client_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const items = db
      .prepare(
        `SELECT * FROM client_onboarding WHERE client_id = ? AND status IN ('pending', 'requested') ORDER BY requested_at`,
      )
      .all(client_id);

    const oldestRequest = items.length > 0 ? items[0].requested_at : null;
    const daysSinceOldest = oldestRequest
      ? Math.floor((Date.now() - new Date(oldestRequest).getTime()) / 86400000)
      : 0;

    return {
      client_id,
      pending_items: items,
      pending_count: items.length,
      oldest_request: oldestRequest,
      days_since_oldest_request: daysSinceOldest,
      needs_followup: daysSinceOldest > 7,
    };
  },
};

const escalate_unresponsive_client = {
  riskLevel: "propose",
  description: "Escalate a client that has not responded to document requests",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client_id } = params;
    if (!client_id) return { error: "client_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const pending = db
      .prepare(
        `SELECT * FROM client_onboarding WHERE client_id = ? AND status IN ('pending', 'requested') ORDER BY requested_at`,
      )
      .all(client_id);

    const atRiskDeadlines = db
      .prepare(
        `SELECT * FROM deadlines WHERE client_id = ? AND status IN ('at_risk', 'overdue') ORDER BY due_date`,
      )
      .all(client_id);

    return {
      escalation: true,
      client_id,
      pending_documents: pending.length,
      at_risk_deadlines: atRiskDeadlines.length,
      details: { pending, at_risk_deadlines: atRiskDeadlines },
      escalated_at: new Date().toISOString(),
    };
  },
};

// ─── Export ──────────────────────────────────────────────────────────

module.exports = {
  // Comptable
  scan_inbox_documents,
  classify_receipt,
  extract_invoice_data,
  detect_duplicate_invoice,
  lookup_vendor,
  draft_journal_entry,
  attach_source_document,
  submit_entry_for_review,
  flag_vendor_anomaly,
  // Echeancier
  scan_compliance_calendar,
  check_vat_deadline,
  check_tax_filing_status,
  create_document_request,
  schedule_reminder,
  escalate_overdue,
  update_deadline_status,
  check_extension_eligibility,
  // Auditeur
  review_journal_entry,
  reconcile_bank_statement,
  detect_anomaly,
  check_missing_documents,
  flag_exception,
  approve_draft_entry,
  reject_draft_entry,
  generate_reconciliation_report,
  // Relations
  scan_client_inbox,
  draft_document_request_email,
  draft_status_digest,
  send_client_email,
  update_onboarding_checklist,
  log_client_interaction,
  create_satisfaction_survey,
  check_client_response_status,
  escalate_unresponsive_client,
};
