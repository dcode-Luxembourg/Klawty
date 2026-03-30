"use strict";

const { ensureVerticalSchema } = require("./vertical-db-schema");

let _schemaReady = false;

function _ensureSchema(db) {
  if (!_schemaReady) {
    ensureVerticalSchema(db, "law-firms");
    _schemaReady = true;
  }
}

// ─── Greffier (9 tools) ─────────────────────────────────────────────

const review_contract = {
  riskLevel: "auto",
  description: "Review a legal document and return structural analysis",
  isWriteTool: false,
  execute: async (params, context) => {
    const { document_id } = params;
    if (!document_id) return { error: "document_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const doc = db.prepare(`SELECT * FROM legal_documents WHERE id = ?`).get(document_id);
    if (!doc) return { error: `Document ${document_id} not found` };

    const clauses = db.prepare(`SELECT * FROM clause_index WHERE document_id = ?`).all(document_id);
    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(doc.matter_id);

    return {
      document_id: doc.id,
      title: doc.title,
      type: doc.type,
      version: doc.version,
      status: doc.status,
      matter: matter
        ? { reference: matter.reference, title: matter.title, type: matter.type }
        : null,
      clauses_count: clauses.length,
      risk_clauses: clauses.filter((c) => c.risk_level === "high" || c.risk_level === "elevated")
        .length,
      clauses_extracted: doc.clauses_extracted,
      reviewed_at: new Date().toISOString(),
    };
  },
};

const extract_clauses = {
  riskLevel: "auto+",
  description: "Extract and index clauses from a legal document",
  isWriteTool: true,
  execute: async (params, context) => {
    const { document_id } = params;
    if (!document_id) return { error: "document_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const doc = db.prepare(`SELECT * FROM legal_documents WHERE id = ?`).get(document_id);
    if (!doc) return { error: `Document ${document_id} not found` };

    // Mark document as having clauses extracted
    db.prepare(
      `UPDATE legal_documents SET clauses_extracted = 1, updated_at = datetime('now') WHERE id = ?`,
    ).run(document_id);

    // Return existing clauses (extraction would be done by the LLM inserting them)
    const existing = db
      .prepare(`SELECT * FROM clause_index WHERE document_id = ?`)
      .all(document_id);
    return {
      document_id,
      title: doc.title,
      clauses_found: existing.length,
      clauses: existing,
      extracted_at: new Date().toISOString(),
    };
  },
};

const compare_versions = {
  riskLevel: "auto",
  description: "Compare two document versions and highlight differences",
  isWriteTool: false,
  execute: async (params, context) => {
    const { doc_id_a, doc_id_b } = params;
    if (!doc_id_a || !doc_id_b) return { error: "doc_id_a and doc_id_b are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const docA = db.prepare(`SELECT * FROM legal_documents WHERE id = ?`).get(doc_id_a);
    const docB = db.prepare(`SELECT * FROM legal_documents WHERE id = ?`).get(doc_id_b);
    if (!docA) return { error: `Document ${doc_id_a} not found` };
    if (!docB) return { error: `Document ${doc_id_b} not found` };

    const clausesA = db
      .prepare(
        `SELECT clause_type, section_number, content, risk_level FROM clause_index WHERE document_id = ?`,
      )
      .all(doc_id_a);
    const clausesB = db
      .prepare(
        `SELECT clause_type, section_number, content, risk_level FROM clause_index WHERE document_id = ?`,
      )
      .all(doc_id_b);

    const typesA = new Set(clausesA.map((c) => c.clause_type));
    const typesB = new Set(clausesB.map((c) => c.clause_type));
    const addedTypes = [...typesB].filter((t) => !typesA.has(t));
    const removedTypes = [...typesA].filter((t) => !typesB.has(t));

    return {
      doc_a: { id: docA.id, title: docA.title, version: docA.version, clauses: clausesA.length },
      doc_b: { id: docB.id, title: docB.title, version: docB.version, clauses: clausesB.length },
      clause_types_added: addedTypes,
      clause_types_removed: removedTypes,
      risk_changes: {
        a_high_risk: clausesA.filter((c) => c.risk_level === "high").length,
        b_high_risk: clausesB.filter((c) => c.risk_level === "high").length,
      },
      compared_at: new Date().toISOString(),
    };
  },
};

const flag_risky_clauses = {
  riskLevel: "auto",
  description: "Identify elevated and high-risk clauses in a document",
  isWriteTool: false,
  execute: async (params, context) => {
    const { document_id } = params;
    if (!document_id) return { error: "document_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const risky = db
      .prepare(
        `SELECT * FROM clause_index WHERE document_id = ? AND risk_level IN ('elevated', 'high') ORDER BY risk_level DESC`,
      )
      .all(document_id);

    return {
      document_id,
      risky_clauses: risky,
      count: risky.length,
      high_count: risky.filter((c) => c.risk_level === "high").length,
      elevated_count: risky.filter((c) => c.risk_level === "elevated").length,
      checked_at: new Date().toISOString(),
    };
  },
};

const generate_clause_index = {
  riskLevel: "auto",
  description: "Generate a full clause index for a document",
  isWriteTool: false,
  execute: async (params, context) => {
    const { document_id } = params;
    if (!document_id) return { error: "document_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const doc = db.prepare(`SELECT * FROM legal_documents WHERE id = ?`).get(document_id);
    if (!doc) return { error: `Document ${document_id} not found` };

    const clauses = db
      .prepare(
        `SELECT * FROM clause_index WHERE document_id = ? ORDER BY section_number, clause_type`,
      )
      .all(document_id);

    const byType = {};
    for (const c of clauses) {
      if (!byType[c.clause_type]) byType[c.clause_type] = [];
      byType[c.clause_type].push(c);
    }

    return {
      document_id,
      title: doc.title,
      total_clauses: clauses.length,
      by_type: byType,
      risk_summary: {
        low: clauses.filter((c) => c.risk_level === "low").length,
        normal: clauses.filter((c) => c.risk_level === "normal").length,
        elevated: clauses.filter((c) => c.risk_level === "elevated").length,
        high: clauses.filter((c) => c.risk_level === "high").length,
      },
    };
  },
};

const draft_template_fill = {
  riskLevel: "propose",
  description: "Fill a document template with matter-specific data",
  isWriteTool: false,
  execute: async (params, context) => {
    const { template_type, matter_id, data } = params;
    if (!template_type || !matter_id) return { error: "template_type and matter_id are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    return {
      template_type,
      matter_id,
      matter_reference: matter.reference,
      client_name: matter.client_name,
      jurisdiction: matter.jurisdiction,
      data: data || {},
      draft: {
        title: `${template_type} - ${matter.reference}`,
        matter_ref: matter.reference,
        client: matter.client_name,
        type: matter.type,
        jurisdiction: matter.jurisdiction,
        fields: data || {},
      },
      prepared_at: new Date().toISOString(),
    };
  },
};

const prepare_notarial_act = {
  riskLevel: "propose",
  description: "Prepare a notarial act for a matter",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, type, data } = params;
    if (!matter_id || !type) return { error: "matter_id and type are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    return {
      act_type: type,
      matter_id,
      matter_reference: matter.reference,
      client_name: matter.client_name,
      jurisdiction: matter.jurisdiction,
      data: data || {},
      prepared_at: new Date().toISOString(),
      message:
        "Notarial act prepared for review. Requires lawyer verification before finalization.",
    };
  },
};

const submit_for_signature = {
  riskLevel: "confirm",
  description: "Submit a document for final signature (requires confirmation)",
  isWriteTool: true,
  execute: async (params, context) => {
    const { document_id } = params;
    if (!document_id) return { error: "document_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const doc = db.prepare(`SELECT * FROM legal_documents WHERE id = ?`).get(document_id);
    if (!doc) return { error: `Document ${document_id} not found` };
    if (doc.status !== "review")
      return { error: `Document ${document_id} is ${doc.status}, must be in review status` };

    db.prepare(
      `UPDATE legal_documents SET status = 'final', updated_at = datetime('now') WHERE id = ?`,
    ).run(document_id);
    return { document_id, title: doc.title, previous_status: "review", new_status: "final" };
  },
};

const archive_document = {
  riskLevel: "auto+",
  description: "Archive a document with optional tags",
  isWriteTool: true,
  execute: async (params, context) => {
    const { document_id, tags } = params;
    if (!document_id) return { error: "document_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const doc = db.prepare(`SELECT * FROM legal_documents WHERE id = ?`).get(document_id);
    if (!doc) return { error: `Document ${document_id} not found` };

    db.prepare(
      `UPDATE legal_documents SET status = 'archived', updated_at = datetime('now') WHERE id = ?`,
    ).run(document_id);
    return {
      document_id,
      title: doc.title,
      previous_status: doc.status,
      new_status: "archived",
      tags: tags || null,
    };
  },
};

// ─── Agenda (8 tools) ───────────────────────────────────────────────

const check_court_deadlines = {
  riskLevel: "auto",
  description: "Check upcoming court deadlines within a time window",
  isWriteTool: false,
  execute: async (params, context) => {
    const { days, matter_id } = params;
    const window = days || 30;
    const db = context.getDatabase();
    _ensureSchema(db);

    let sql = `SELECT cd.*, m.reference, m.title as matter_title, m.client_name
               FROM court_deadlines cd
               JOIN matters m ON cd.matter_id = m.id
               WHERE cd.due_date <= date('now', '+' || ? || ' days') AND cd.status NOT IN ('completed')`;
    const values = [window];
    if (matter_id) {
      sql += ` AND cd.matter_id = ?`;
      values.push(matter_id);
    }
    sql += ` ORDER BY cd.due_date ASC`;

    const deadlines = db.prepare(sql).all(...values);
    return {
      window_days: window,
      matter_id: matter_id || "all",
      count: deadlines.length,
      deadlines,
    };
  },
};

const calculate_limitation_period = {
  riskLevel: "auto+",
  description: "Calculate and record a limitation period for a matter",
  isWriteTool: true,
  execute: async (params, context) => {
    const { matter_id, type, event_date, period_years } = params;
    if (!matter_id || !type || !event_date || !period_years) {
      return { error: "matter_id, type, event_date, and period_years are required" };
    }
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    const eventDateObj = new Date(event_date);
    const expiryDate = new Date(eventDateObj);
    expiryDate.setFullYear(expiryDate.getFullYear() + period_years);
    const expiryStr = expiryDate.toISOString().split("T")[0];

    const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / 86400000);
    const status =
      daysUntilExpiry <= 0 ? "expired" : daysUntilExpiry <= 90 ? "expiring" : "running";

    const result = db
      .prepare(
        `INSERT INTO limitation_periods (matter_id, type, event_date, period_years, expiry_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(matter_id, type, event_date, period_years, expiryStr, status);

    return {
      id: result.lastInsertRowid,
      matter_id,
      matter_reference: matter.reference,
      type,
      event_date,
      period_years,
      expiry_date: expiryStr,
      days_until_expiry: daysUntilExpiry,
      status,
    };
  },
};

const detect_conflicts = {
  riskLevel: "auto+",
  description: "Run a conflict-of-interest check for an entity",
  isWriteTool: true,
  execute: async (params, context) => {
    const { entity, entity_type } = params;
    if (!entity || !entity_type) return { error: "entity and entity_type are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const validTypes = ["client", "opposing_party", "related_entity"];
    if (!validTypes.includes(entity_type))
      return { error: `Invalid entity_type. Valid: ${validTypes.join(", ")}` };

    // Check existing matters for conflicts
    const asClient = db
      .prepare(`SELECT id, reference, title FROM matters WHERE client_name LIKE ?`)
      .all(`%${entity}%`);
    const asConflict = db
      .prepare(`SELECT * FROM conflicts WHERE checked_entity LIKE ?`)
      .all(`%${entity}%`);

    const conflictFound = asClient.length > 0 && entity_type === "opposing_party";

    // Record the conflict check for all matters involving this entity
    const matters = db.prepare(`SELECT id FROM matters WHERE stage != 'archived'`).all();
    if (matters.length > 0) {
      const insert = db.prepare(
        `INSERT INTO conflicts (matter_id, checked_entity, entity_type, conflict_found, details)
         VALUES (?, ?, ?, ?, ?)`,
      );
      insert.run(
        matters[0].id,
        entity,
        entity_type,
        conflictFound ? 1 : 0,
        conflictFound ? `Entity appears as client in ${asClient.length} matter(s)` : null,
      );
    }

    return {
      entity,
      entity_type,
      conflict_found: conflictFound,
      existing_as_client: asClient,
      previous_checks: asConflict,
      checked_at: new Date().toISOString(),
    };
  },
};

const schedule_hearing = {
  riskLevel: "auto+",
  description: "Schedule a court hearing or deadline for a matter",
  isWriteTool: true,
  execute: async (params, context) => {
    const { matter_id, date, type, location } = params;
    if (!matter_id || !date || !type) return { error: "matter_id, date, and type are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    const result = db
      .prepare(
        `INSERT INTO court_deadlines (matter_id, type, description, due_date, status)
       VALUES (?, ?, ?, ?, 'upcoming')`,
      )
      .run(matter_id, type, location ? `${type} at ${location}` : type, date);

    return {
      id: result.lastInsertRowid,
      matter_id,
      matter_reference: matter.reference,
      type,
      date,
      location: location || null,
      status: "upcoming",
    };
  },
};

const send_deadline_alert = {
  riskLevel: "auto+",
  description: "Update alert flags for a court deadline",
  isWriteTool: true,
  execute: async (params, context) => {
    const { deadline_id, tier } = params;
    if (!deadline_id || !tier) return { error: "deadline_id and tier are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const deadline = db.prepare(`SELECT * FROM court_deadlines WHERE id = ?`).get(deadline_id);
    if (!deadline) return { error: `Deadline ${deadline_id} not found` };

    const validTiers = ["t7", "t3", "t1"];
    if (!validTiers.includes(tier))
      return { error: `Invalid tier. Valid: ${validTiers.join(", ")}` };

    const column = `alert_sent_${tier}`;
    db.prepare(`UPDATE court_deadlines SET ${column} = 1 WHERE id = ?`).run(deadline_id);

    return {
      deadline_id,
      tier,
      alert_sent: true,
      type: deadline.type,
      due_date: deadline.due_date,
    };
  },
};

const update_matter_status = {
  riskLevel: "auto+",
  description: "Update the stage of a legal matter",
  isWriteTool: true,
  execute: async (params, context) => {
    const { matter_id, stage } = params;
    if (!matter_id || !stage) return { error: "matter_id and stage are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    const validStages = ["intake", "active", "hearing", "judgment", "appeal", "closed", "archived"];
    if (!validStages.includes(stage))
      return { error: `Invalid stage. Valid: ${validStages.join(", ")}` };

    let sql = `UPDATE matters SET stage = ?`;
    const values = [stage];
    if (stage === "closed" || stage === "archived") {
      sql += `, closed_at = datetime('now')`;
    }
    sql += ` WHERE id = ?`;
    values.push(matter_id);
    db.prepare(sql).run(...values);

    return {
      matter_id,
      reference: matter.reference,
      previous_stage: matter.stage,
      new_stage: stage,
    };
  },
};

const request_adjournment = {
  riskLevel: "propose",
  description: "Request an adjournment for a court deadline",
  isWriteTool: false,
  execute: async (params, context) => {
    const { deadline_id, grounds, proposed_date } = params;
    if (!deadline_id || !grounds) return { error: "deadline_id and grounds are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const deadline = db
      .prepare(
        `SELECT cd.*, m.reference, m.client_name FROM court_deadlines cd JOIN matters m ON cd.matter_id = m.id WHERE cd.id = ?`,
      )
      .get(deadline_id);
    if (!deadline) return { error: `Deadline ${deadline_id} not found` };

    return {
      adjournment_request: true,
      deadline_id,
      matter_reference: deadline.reference,
      client: deadline.client_name,
      current_date: deadline.due_date,
      proposed_date: proposed_date || null,
      grounds,
      prepared_at: new Date().toISOString(),
      message: "Adjournment request drafted. Requires lawyer review before filing.",
    };
  },
};

const reassign_matter = {
  riskLevel: "confirm",
  description: "Reassign a matter to a different lawyer (requires confirmation)",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, new_lawyer } = params;
    if (!matter_id || !new_lawyer) return { error: "matter_id and new_lawyer are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    return {
      reassignment: true,
      matter_id,
      reference: matter.reference,
      title: matter.title,
      current_lawyer: matter.responsible_lawyer,
      new_lawyer,
      confirmation_required: true,
      prepared_at: new Date().toISOString(),
    };
  },
};

// ─── Recherche (8 tools) ────────────────────────────────────────────

const search_case_law = {
  riskLevel: "auto",
  description: "Search case law by query, jurisdiction, and date range",
  isWriteTool: false,
  execute: async (params, context) => {
    const { query, jurisdiction, date_range } = params;
    if (!query) return { error: "query is required" };

    return {
      query,
      jurisdiction: jurisdiction || "all",
      date_range: date_range || null,
      results: [],
      count: 0,
      message:
        "Case law search requires external legal database integration. Query prepared for execution.",
      searched_at: new Date().toISOString(),
    };
  },
};

const summarize_precedent = {
  riskLevel: "auto",
  description: "Return a structured summary of a legal precedent",
  isWriteTool: false,
  execute: async (params, context) => {
    const { case_ref } = params;
    if (!case_ref) return { error: "case_ref is required" };

    return {
      case_ref,
      summary: {
        reference: case_ref,
        court: null,
        date: null,
        parties: null,
        issue: null,
        holding: null,
        ratio: null,
        relevance: null,
      },
      message: "Precedent summary requires external legal database. Reference prepared for lookup.",
      requested_at: new Date().toISOString(),
    };
  },
};

const monitor_legislation = {
  riskLevel: "auto",
  description: "Monitor legislative changes for a jurisdiction or domain",
  isWriteTool: false,
  execute: async (params, context) => {
    const { jurisdiction, domain } = params;

    return {
      jurisdiction: jurisdiction || "all",
      domain: domain || "all",
      changes: [],
      count: 0,
      message:
        "Legislative monitoring requires external legal feed integration. Parameters prepared.",
      checked_at: new Date().toISOString(),
    };
  },
};

const build_jurisdiction_digest = {
  riskLevel: "auto",
  description: "Build a jurisdiction digest for a specific domain",
  isWriteTool: false,
  execute: async (params, context) => {
    const { jurisdiction, domain } = params;
    if (!jurisdiction || !domain) return { error: "jurisdiction and domain are required" };

    return {
      jurisdiction,
      domain,
      digest: {
        jurisdiction,
        domain,
        key_statutes: [],
        recent_changes: [],
        upcoming_reforms: [],
        relevant_courts: [],
      },
      message: "Jurisdiction digest requires external legal database integration.",
      generated_at: new Date().toISOString(),
    };
  },
};

const analyze_opposing_argument = {
  riskLevel: "auto",
  description: "Analyze an opposing argument for a matter",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, position } = params;
    if (!matter_id || !position) return { error: "matter_id and position are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    return {
      matter_id,
      matter_reference: matter.reference,
      matter_type: matter.type,
      opposing_position: position,
      analysis: {
        strengths: [],
        weaknesses: [],
        counter_arguments: [],
        recommended_strategy: null,
      },
      message: "Opposing argument analysis prepared for lawyer review.",
      analyzed_at: new Date().toISOString(),
    };
  },
};

const draft_legal_memo = {
  riskLevel: "propose",
  description: "Draft and store a legal research memo",
  isWriteTool: true,
  execute: async (params, context) => {
    const { matter_id, topic, jurisdiction } = params;
    if (!matter_id || !topic) return { error: "matter_id and topic are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    const result = db
      .prepare(
        `INSERT INTO research_memos (matter_id, topic, jurisdiction, status)
       VALUES (?, ?, ?, 'draft')`,
      )
      .run(matter_id, topic, jurisdiction || matter.jurisdiction);

    return {
      memo_id: result.lastInsertRowid,
      matter_id,
      matter_reference: matter.reference,
      topic,
      jurisdiction: jurisdiction || matter.jurisdiction,
      status: "draft",
      created_at: new Date().toISOString(),
    };
  },
};

const flag_regulatory_change = {
  riskLevel: "auto",
  description: "Flag a regulatory change and identify affected matters",
  isWriteTool: false,
  execute: async (params, context) => {
    const { change_description, affected_matters } = params;
    if (!change_description) return { error: "change_description is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    let matterDetails = [];
    if (affected_matters && Array.isArray(affected_matters)) {
      const placeholders = affected_matters.map(() => "?").join(",");
      matterDetails = db
        .prepare(
          `SELECT id, reference, title, type, stage FROM matters WHERE id IN (${placeholders})`,
        )
        .all(...affected_matters);
    }

    return {
      alert: true,
      change_description,
      affected_matters: matterDetails,
      affected_count: matterDetails.length,
      flagged_at: new Date().toISOString(),
    };
  },
};

const cite_check = {
  riskLevel: "auto",
  description: "Verify the validity and accuracy of legal citations",
  isWriteTool: false,
  execute: async (params, context) => {
    const { citations } = params;
    if (!citations || !Array.isArray(citations) || citations.length === 0) {
      return { error: "citations (array of strings) is required" };
    }

    const results = citations.map((cite) => ({
      citation: cite,
      valid: null,
      current: null,
      notes: "Citation verification requires external legal database integration.",
    }));

    return {
      citations_checked: citations.length,
      results,
      message: "Citation check prepared. External database lookup required for full verification.",
      checked_at: new Date().toISOString(),
    };
  },
};

// ─── Correspondance (9 tools) ───────────────────────────────────────

const triage_client_email = {
  riskLevel: "auto",
  description: "Classify and triage an incoming client email",
  isWriteTool: false,
  execute: async (params, context) => {
    const { email_id } = params;
    if (!email_id) return { error: "email_id is required" };

    return {
      email_id,
      classification: {
        urgency: null,
        category: null,
        matter_reference: null,
        action_required: null,
        suggested_response_type: null,
      },
      message: "Email triage requires email integration. Classification prepared.",
      triaged_at: new Date().toISOString(),
    };
  },
};

const draft_status_update = {
  riskLevel: "auto",
  description: "Draft a status update communication for a matter",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id } = params;
    if (!matter_id) return { error: "matter_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    const deadlines = db
      .prepare(
        `SELECT type, due_date, status FROM court_deadlines WHERE matter_id = ? AND status != 'completed' ORDER BY due_date LIMIT 5`,
      )
      .all(matter_id);

    const docs = db
      .prepare(
        `SELECT title, type, status FROM legal_documents WHERE matter_id = ? ORDER BY updated_at DESC LIMIT 5`,
      )
      .all(matter_id);

    return {
      matter_id,
      matter_reference: matter.reference,
      client: matter.client_name,
      draft: {
        subject: `Status Update - ${matter.reference} - ${matter.title}`,
        stage: matter.stage,
        upcoming_deadlines: deadlines,
        recent_documents: docs,
      },
      prepared_at: new Date().toISOString(),
    };
  },
};

const draft_document_request = {
  riskLevel: "auto",
  description: "Draft a document request to the client for a matter",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, items } = params;
    if (!matter_id || !items || !Array.isArray(items) || items.length === 0) {
      return { error: "matter_id and items (array) are required" };
    }
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    const itemList = items.map((i) => `- ${i}`).join("\n");

    return {
      matter_id,
      matter_reference: matter.reference,
      client: matter.client_name,
      draft: {
        subject: `Documents requis - ${matter.reference}`,
        body: `Cher(e) ${matter.client_name},\n\nDans le cadre du dossier ${matter.reference}, nous avons besoin des documents suivants:\n\n${itemList}\n\nMerci de nous les transmettre dans les meilleurs délais.\n\nCordialement`,
        items,
      },
      prepared_at: new Date().toISOString(),
    };
  },
};

const generate_billing_summary = {
  riskLevel: "auto",
  description: "Generate a billing summary for a matter",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id } = params;
    if (!matter_id) return { error: "matter_id is required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    const entries = db
      .prepare(`SELECT * FROM billing WHERE matter_id = ? ORDER BY date DESC`)
      .all(matter_id);
    const totals = db
      .prepare(
        `SELECT type, SUM(amount) as total, COUNT(*) as count FROM billing WHERE matter_id = ? GROUP BY type`,
      )
      .all(matter_id);
    const grandTotal = db
      .prepare(`SELECT SUM(amount) as total FROM billing WHERE matter_id = ?`)
      .get(matter_id);
    const uninvoiced = db
      .prepare(`SELECT SUM(amount) as total FROM billing WHERE matter_id = ? AND invoiced = 0`)
      .get(matter_id);

    return {
      matter_id,
      matter_reference: matter.reference,
      client: matter.client_name,
      entries_count: entries.length,
      by_type: totals,
      grand_total: grandTotal.total || 0,
      uninvoiced_total: uninvoiced.total || 0,
      entries,
      generated_at: new Date().toISOString(),
    };
  },
};

const confirm_appointment = {
  riskLevel: "auto",
  description: "Prepare an appointment confirmation for a matter",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, date, time, location } = params;
    if (!matter_id || !date || !time) return { error: "matter_id, date, and time are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    return {
      matter_id,
      matter_reference: matter.reference,
      client: matter.client_name,
      appointment: { date, time, location: location || "Office" },
      confirmation: {
        subject: `Confirmation de rendez-vous - ${matter.reference}`,
        body: `Cher(e) ${matter.client_name},\n\nNous confirmons votre rendez-vous:\n\nDate: ${date}\nHeure: ${time}\nLieu: ${location || "Notre cabinet"}\nDossier: ${matter.reference}\n\nCordialement`,
      },
      prepared_at: new Date().toISOString(),
    };
  },
};

const send_client_email = {
  riskLevel: "propose",
  description: "Send an email to the client for a matter",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, subject, content } = params;
    if (!matter_id || !subject || !content)
      return { error: "matter_id, subject, and content are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    return {
      matter_id,
      matter_reference: matter.reference,
      client: matter.client_name,
      subject,
      content,
      prepared_at: new Date().toISOString(),
      message: "Email prepared for sending. Awaiting proposal approval.",
    };
  },
};

const log_communication = {
  riskLevel: "auto",
  description: "Log a communication event for a matter",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, type, channel, summary } = params;
    if (!matter_id || !type || !summary)
      return { error: "matter_id, type, and summary are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    return {
      log_entry: true,
      matter_id,
      matter_reference: matter.reference,
      type,
      channel: channel || "email",
      summary,
      logged_at: new Date().toISOString(),
    };
  },
};

const escalate_to_lawyer = {
  riskLevel: "auto",
  description: "Escalate a matter issue to the responsible lawyer",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, reason, urgency } = params;
    if (!matter_id || !reason) return { error: "matter_id and reason are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    return {
      escalation: true,
      matter_id,
      matter_reference: matter.reference,
      responsible_lawyer: matter.responsible_lawyer,
      client: matter.client_name,
      reason,
      urgency: urgency || "normal",
      escalated_at: new Date().toISOString(),
    };
  },
};

const send_secure_document = {
  riskLevel: "propose",
  description: "Prepare a secure document link for client delivery",
  isWriteTool: false,
  execute: async (params, context) => {
    const { matter_id, document_id, recipient } = params;
    if (!matter_id || !document_id) return { error: "matter_id and document_id are required" };
    const db = context.getDatabase();
    _ensureSchema(db);

    const matter = db.prepare(`SELECT * FROM matters WHERE id = ?`).get(matter_id);
    if (!matter) return { error: `Matter ${matter_id} not found` };

    const doc = db
      .prepare(`SELECT * FROM legal_documents WHERE id = ? AND matter_id = ?`)
      .get(document_id, matter_id);
    if (!doc) return { error: `Document ${document_id} not found in matter ${matter_id}` };

    return {
      matter_id,
      matter_reference: matter.reference,
      document_id,
      document_title: doc.title,
      recipient: recipient || matter.client_name,
      secure_link: null,
      prepared_at: new Date().toISOString(),
      message: "Secure document delivery prepared. Awaiting proposal approval.",
    };
  },
};

// ─── Export ──────────────────────────────────────────────────────────

module.exports = {
  // Greffier
  review_contract,
  extract_clauses,
  compare_versions,
  flag_risky_clauses,
  generate_clause_index,
  draft_template_fill,
  prepare_notarial_act,
  submit_for_signature,
  archive_document,
  // Agenda
  check_court_deadlines,
  calculate_limitation_period,
  detect_conflicts,
  schedule_hearing,
  send_deadline_alert,
  update_matter_status,
  request_adjournment,
  reassign_matter,
  // Recherche
  search_case_law,
  summarize_precedent,
  monitor_legislation,
  build_jurisdiction_digest,
  analyze_opposing_argument,
  draft_legal_memo,
  flag_regulatory_change,
  cite_check,
  // Correspondance
  triage_client_email,
  draft_status_update,
  draft_document_request,
  generate_billing_summary,
  confirm_appointment,
  send_client_email,
  log_communication,
  escalate_to_lawyer,
  send_secure_document,
};
