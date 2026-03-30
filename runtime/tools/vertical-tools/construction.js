"use strict";

const { ensureVerticalSchema } = require("./vertical-db-schema");

let _schemaReady = false;

function _ensureSchema(db) {
  if (!_schemaReady) {
    ensureVerticalSchema(db, "construction");
    _schemaReady = true;
  }
}

// ─── Chef de Projet (Project Management) ─────────────────────────────────────

const list_milestones = {
  riskLevel: "auto",
  description: "List project milestones, optionally filtered by project or status",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql =
      "SELECT m.*, p.name as project_name FROM milestones m JOIN projects p ON m.project_id = p.id WHERE 1=1";
    const args = [];
    if (params.project_id) {
      sql += " AND m.project_id = ?";
      args.push(params.project_id);
    }
    if (params.status) {
      sql += " AND m.status = ?";
      args.push(params.status);
    }
    sql += " ORDER BY m.planned_date ASC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, milestones: rows };
  },
};

const get_project_timeline = {
  riskLevel: "auto",
  description: "Get the full timeline of milestones and project details",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const milestones = db
      .prepare("SELECT * FROM milestones WHERE project_id = ? ORDER BY planned_date ASC")
      .all(params.project_id);

    return {
      success: true,
      project,
      milestones,
      total_milestones: milestones.length,
      completed: milestones.filter((m) => m.status === "completed").length,
      delayed: milestones.filter((m) => m.status === "delayed").length,
    };
  },
};

const detect_delays = {
  riskLevel: "auto",
  description: "Detect milestones where actual progress is behind planned schedule",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql = `SELECT m.*, p.name as project_name
               FROM milestones m JOIN projects p ON m.project_id = p.id
               WHERE m.status IN ('pending', 'started', 'delayed')
               AND m.planned_date < date('now')
               AND m.status != 'completed'`;
    const args = [];
    if (params.project_id) {
      sql += " AND m.project_id = ?";
      args.push(params.project_id);
    }
    sql += " ORDER BY m.planned_date ASC";

    const rows = db.prepare(sql).all(...args);
    const delays = rows.map((m) => {
      const planned = new Date(m.planned_date);
      const daysLate = Math.floor((Date.now() - planned.getTime()) / 86400000);
      return { ...m, days_late: daysLate };
    });
    return { success: true, count: delays.length, delays };
  },
};

const update_milestone_status = {
  riskLevel: "auto+",
  description: "Update a milestone status with optional notes and evidence",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const milestone = db.prepare("SELECT * FROM milestones WHERE id = ?").get(params.milestone_id);
    if (!milestone) return { success: false, error: `Milestone ${params.milestone_id} not found` };
    const validStatuses = ["pending", "started", "completed", "delayed", "blocked"];
    if (!validStatuses.includes(params.status))
      return { success: false, error: `Invalid status: ${params.status}` };

    const updates = ["status = ?"];
    const args = [params.status];
    if (params.notes) {
      updates.push("notes = ?");
      args.push(params.notes);
    }
    if (params.evidence) {
      updates.push("evidence = ?");
      args.push(params.evidence);
    }
    if (params.status === "completed") {
      updates.push("actual_date = date('now')");
      updates.push("percent_complete = 100");
    }
    args.push(params.milestone_id);

    db.prepare(`UPDATE milestones SET ${updates.join(", ")} WHERE id = ?`).run(...args);
    return {
      success: true,
      milestone_id: params.milestone_id,
      previous_status: milestone.status,
      new_status: params.status,
    };
  },
};

const allocate_resource = {
  riskLevel: "propose",
  description: "Propose resource allocation for a project phase",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id, name FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    return {
      success: true,
      action: "propose",
      allocation: {
        project: { id: project.id, name: project.name },
        phase: params.phase,
        resource: params.resource,
        dates: params.dates,
        proposed_at: new Date().toISOString(),
      },
    };
  },
};

const create_delay_alert = {
  riskLevel: "auto+",
  description: "Create a delay alert for a milestone with impact assessment",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const milestone = db
      .prepare(
        "SELECT m.*, p.name as project_name FROM milestones m JOIN projects p ON m.project_id = p.id WHERE m.id = ?",
      )
      .get(params.milestone_id);
    if (!milestone) return { success: false, error: `Milestone ${params.milestone_id} not found` };

    return {
      success: true,
      alert: {
        milestone: {
          id: milestone.id,
          name: milestone.name,
          phase: milestone.phase,
          planned_date: milestone.planned_date,
        },
        project: milestone.project_name,
        impact: params.impact,
        severity: milestone.status === "blocked" ? "critical" : "warning",
        created_at: new Date().toISOString(),
      },
    };
  },
};

const schedule_site_meeting = {
  riskLevel: "propose",
  description: "Schedule a site meeting with agenda and attendees",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id, name FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    return {
      success: true,
      action: "propose",
      meeting: {
        project: { id: project.id, name: project.name },
        date: params.date,
        agenda: params.agenda,
        attendees: params.attendees,
        scheduled_at: new Date().toISOString(),
      },
    };
  },
};

const reassign_subcontractor = {
  riskLevel: "confirm",
  description: "Reassign work from one subcontractor to another (requires confirmation)",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id, name FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    return {
      success: true,
      action: "confirm",
      reassignment: {
        project: { id: project.id, name: project.name },
        old_subcontractor: params.old_sub,
        new_subcontractor: params.new_sub,
        requires_confirmation: true,
        proposed_at: new Date().toISOString(),
      },
    };
  },
};

const generate_weekly_snapshot = {
  riskLevel: "auto",
  description: "Generate a weekly project snapshot with aggregated stats",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const milestones = db
      .prepare(
        "SELECT status, COUNT(*) as count FROM milestones WHERE project_id = ? GROUP BY status",
      )
      .all(params.project_id);
    const delayed = db
      .prepare(
        "SELECT COUNT(*) as count FROM milestones WHERE project_id = ? AND status IN ('delayed', 'blocked')",
      )
      .get(params.project_id);
    const openRfqs = db
      .prepare(
        "SELECT COUNT(*) as count FROM rfqs WHERE project_id = ? AND status IN ('open', 'sent')",
      )
      .get(params.project_id);
    const pendingOrders = db
      .prepare(
        "SELECT COUNT(*) as count FROM purchase_orders WHERE project_id = ? AND status IN ('pending', 'confirmed', 'shipped')",
      )
      .get(params.project_id);
    const recentInspections = db
      .prepare(
        "SELECT COUNT(*) as count FROM inspections WHERE project_id = ? AND date >= date('now', '-7 days')",
      )
      .get(params.project_id);

    return {
      success: true,
      snapshot: {
        project: {
          id: project.id,
          name: project.name,
          client: project.client,
          budget: project.budget,
          spent: project.spent,
          budget_used_pct: project.budget
            ? ((project.spent / project.budget) * 100).toFixed(1) + "%"
            : "N/A",
        },
        milestones_by_status: milestones,
        delayed_count: delayed.count,
        open_rfqs: openRfqs.count,
        pending_orders: pendingOrders.count,
        inspections_this_week: recentInspections.count,
        generated_at: new Date().toISOString(),
      },
    };
  },
};

// ─── Metreur (Procurement & Budget) ──────────────────────────────────────────

const list_open_rfqs = {
  riskLevel: "auto",
  description: "List open requests for quotation, optionally filtered by project",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql =
      "SELECT r.*, p.name as project_name FROM rfqs r JOIN projects p ON r.project_id = p.id WHERE r.status IN ('open', 'sent')";
    const args = [];
    if (params.project_id) {
      sql += " AND r.project_id = ?";
      args.push(params.project_id);
    }
    sql += " ORDER BY r.deadline ASC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, rfqs: rows };
  },
};

const get_budget_vs_actual = {
  riskLevel: "auto",
  description: "Compare budget vs actual spending for a project",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const orders = db
      .prepare(
        "SELECT SUM(total) as total_ordered, COUNT(*) as order_count FROM purchase_orders WHERE project_id = ?",
      )
      .get(params.project_id);
    const delivered = db
      .prepare(
        "SELECT SUM(total) as total_delivered FROM purchase_orders WHERE project_id = ? AND status = 'delivered'",
      )
      .get(params.project_id);

    return {
      success: true,
      project: { id: project.id, name: project.name },
      budget: project.budget,
      spent: project.spent,
      total_ordered: orders.total_ordered || 0,
      total_delivered: delivered.total_delivered || 0,
      remaining: project.budget ? project.budget - project.spent : null,
      utilization_pct: project.budget
        ? ((project.spent / project.budget) * 100).toFixed(1) + "%"
        : "N/A",
      order_count: orders.order_count,
    };
  },
};

const search_supplier_catalog = {
  riskLevel: "auto",
  description: "Search supplier catalog for materials or categories",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql =
      "SELECT DISTINCT supplier, material, unit, AVG(sq.price) as avg_price, COUNT(*) as quote_count FROM rfqs r LEFT JOIN supplier_quotes sq ON r.id = sq.rfq_id WHERE 1=1";
    const args = [];
    if (params.material) {
      sql += " AND r.material LIKE ?";
      args.push("%" + params.material + "%");
    }
    if (params.category) {
      sql += " AND r.material LIKE ?";
      args.push("%" + params.category + "%");
    }
    sql += " GROUP BY supplier, material, unit ORDER BY avg_price ASC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, suppliers: rows };
  },
};

const create_rfq = {
  riskLevel: "auto+",
  description: "Create a new request for quotation for a project",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const result = db
      .prepare(
        "INSERT INTO rfqs (project_id, material, quantity, unit, deadline) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        params.project_id,
        params.material,
        params.quantity,
        params.unit,
        params.deadline || null,
      );
    return {
      success: true,
      rfq_id: result.lastInsertRowid,
      project_id: params.project_id,
      material: params.material,
      quantity: params.quantity,
      unit: params.unit,
    };
  },
};

const compare_quotes = {
  riskLevel: "auto",
  description: "Compare supplier quotes for a given RFQ",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const rfq = db
      .prepare(
        "SELECT r.*, p.name as project_name FROM rfqs r JOIN projects p ON r.project_id = p.id WHERE r.id = ?",
      )
      .get(params.rfq_id);
    if (!rfq) return { success: false, error: `RFQ ${params.rfq_id} not found` };

    const quotes = db
      .prepare("SELECT * FROM supplier_quotes WHERE rfq_id = ? ORDER BY price ASC")
      .all(params.rfq_id);
    const bestPrice = quotes.length > 0 ? quotes[0] : null;
    const bestQuality =
      quotes.length > 0
        ? quotes.reduce(
            (best, q) => ((q.quality_score || 0) > (best.quality_score || 0) ? q : best),
            quotes[0],
          )
        : null;

    return {
      success: true,
      rfq: {
        id: rfq.id,
        material: rfq.material,
        quantity: rfq.quantity,
        unit: rfq.unit,
        deadline: rfq.deadline,
      },
      quotes_count: quotes.length,
      quotes,
      recommendation: { best_price: bestPrice, best_quality: bestQuality },
    };
  },
};

const place_order = {
  riskLevel: "confirm",
  description: "Place a purchase order with a supplier (requires confirmation)",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db
      .prepare("SELECT id, name, budget, spent FROM projects WHERE id = ?")
      .get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const result = db
      .prepare(
        "INSERT INTO purchase_orders (project_id, supplier, items, total, delivery_date) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        params.project_id,
        params.supplier,
        typeof params.items === "string" ? params.items : JSON.stringify(params.items),
        params.total,
        params.delivery_date || null,
      );

    db.prepare("UPDATE projects SET spent = spent + ? WHERE id = ?").run(
      params.total,
      params.project_id,
    );

    return {
      success: true,
      action: "confirm",
      order_id: result.lastInsertRowid,
      project: project.name,
      supplier: params.supplier,
      total: params.total,
      new_spent: project.spent + params.total,
      budget_remaining: project.budget ? project.budget - project.spent - params.total : null,
    };
  },
};

const track_delivery = {
  riskLevel: "auto",
  description: "Track delivery status of purchase orders for a project",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql =
      "SELECT po.*, p.name as project_name FROM purchase_orders po JOIN projects p ON po.project_id = p.id WHERE 1=1";
    const args = [];
    if (params.project_id) {
      sql += " AND po.project_id = ?";
      args.push(params.project_id);
    }
    sql += " ORDER BY po.delivery_date ASC";
    const rows = db.prepare(sql).all(...args);

    const overdue = rows.filter(
      (r) => r.delivery_date && new Date(r.delivery_date) < new Date() && r.status !== "delivered",
    );
    return {
      success: true,
      count: rows.length,
      orders: rows,
      overdue_count: overdue.length,
      overdue,
    };
  },
};

const flag_budget_overrun = {
  riskLevel: "auto",
  description: "Flag projects where spending exceeds budget threshold",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const threshold = params.threshold || 90;

    let sql = "SELECT * FROM projects WHERE budget > 0";
    const args = [];
    if (params.project_id) {
      sql += " AND id = ?";
      args.push(params.project_id);
    }

    const projects = db.prepare(sql).all(...args);
    const flagged = projects
      .filter((p) => (p.spent / p.budget) * 100 >= threshold)
      .map((p) => ({
        id: p.id,
        name: p.name,
        budget: p.budget,
        spent: p.spent,
        utilization_pct: ((p.spent / p.budget) * 100).toFixed(1) + "%",
        remaining: p.budget - p.spent,
        over_budget: p.spent > p.budget,
      }));

    return { success: true, threshold_pct: threshold, flagged_count: flagged.length, flagged };
  },
};

// ─── Conformite (Compliance & Safety) ────────────────────────────────────────

const list_permits = {
  riskLevel: "auto",
  description: "List permits for a project or all projects",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql =
      "SELECT pm.*, p.name as project_name FROM permits pm JOIN projects p ON pm.project_id = p.id WHERE 1=1";
    const args = [];
    if (params.project_id) {
      sql += " AND pm.project_id = ?";
      args.push(params.project_id);
    }
    sql += " ORDER BY pm.expiry_date ASC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, permits: rows };
  },
};

const check_certifications = {
  riskLevel: "auto",
  description: "Check certification status for an entity (subcontractor, supplier, etc.)",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql = "SELECT * FROM certifications WHERE 1=1";
    const args = [];
    if (params.entity_name) {
      sql += " AND entity_name LIKE ?";
      args.push("%" + params.entity_name + "%");
    }
    sql += " ORDER BY valid_until ASC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, certifications: rows };
  },
};

const get_safety_checklist = {
  riskLevel: "auto",
  description: "Generate a safety checklist for a project phase",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id, name FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const phaseChecklists = {
      demolition: [
        "Site perimeter secured",
        "Asbestos survey completed",
        "Utility disconnections confirmed",
        "PPE requirements posted",
        "Dust mitigation plan active",
        "Structural engineer clearance",
      ],
      foundation: [
        "Soil report reviewed",
        "Excavation permit obtained",
        "Underground utilities marked",
        "Shoring/bracing in place",
        "Concrete pour schedule confirmed",
        "Waterproofing plan ready",
      ],
      structure: [
        "Scaffolding inspected",
        "Crane certification current",
        "Fall protection in place",
        "Steel connection inspections scheduled",
        "Load capacity verified",
        "Weather monitoring active",
      ],
      finishing: [
        "Ventilation adequate for indoor work",
        "Chemical storage compliant",
        "Fire extinguishers placed",
        "Electrical lockout/tagout",
        "Dust extraction operational",
        "Clean work areas maintained",
      ],
      handover: [
        "Final inspection completed",
        "All permits closed",
        "As-built drawings delivered",
        "O&M manuals compiled",
        "Warranty documents collected",
        "Client walkthrough scheduled",
      ],
    };

    const checklist = phaseChecklists[params.phase] || [
      "General site safety check",
      "PPE compliance",
      "Emergency exits clear",
      "First aid kit stocked",
      "Fire safety equipment checked",
    ];

    return {
      success: true,
      project: project.name,
      phase: params.phase,
      checklist: checklist.map((item) => ({ item, checked: false })),
    };
  },
};

const flag_expiring_document = {
  riskLevel: "auto",
  description: "Find permits and certifications expiring within N days",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const days = params.days || 30;

    const expiringPermits = db
      .prepare(
        `SELECT pm.*, p.name as project_name, 'permit' as doc_category
       FROM permits pm JOIN projects p ON pm.project_id = p.id
       WHERE pm.expiry_date IS NOT NULL
       AND pm.expiry_date <= date('now', '+' || ? || ' days')
       AND pm.status NOT IN ('expired', 'rejected')
       ORDER BY pm.expiry_date ASC`,
      )
      .all(days);

    const expiringCerts = db
      .prepare(
        `SELECT *, 'certification' as doc_category FROM certifications
       WHERE valid_until IS NOT NULL
       AND valid_until <= date('now', '+' || ? || ' days')
       AND status NOT IN ('expired', 'missing')
       ORDER BY valid_until ASC`,
      )
      .all(days);

    return {
      success: true,
      days_threshold: days,
      expiring_permits: expiringPermits,
      expiring_certifications: expiringCerts,
      total: expiringPermits.length + expiringCerts.length,
    };
  },
};

const request_document = {
  riskLevel: "auto+",
  description: "Create a document request for an entity",
  isWriteTool: true,
  execute: async (params, context) => {
    return {
      success: true,
      request: {
        entity: params.entity_name,
        doc_type: params.doc_type,
        deadline: params.deadline,
        requested_at: new Date().toISOString(),
      },
    };
  },
};

const log_inspection_construction = {
  riskLevel: "auto+",
  description: "Log an inspection result for a construction project",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const result = db
      .prepare(
        "INSERT INTO inspections (project_id, type, inspector, date, result, deficiencies, followup_deadline) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        params.project_id,
        params.type,
        params.inspector,
        params.date,
        params.result,
        params.deficiencies || null,
        params.deficiencies
          ? new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]
          : null,
      );

    return {
      success: true,
      inspection_id: result.lastInsertRowid,
      project_id: params.project_id,
      type: params.type,
      result: params.result,
      has_deficiencies: !!params.deficiencies,
    };
  },
};

const schedule_inspection = {
  riskLevel: "propose",
  description: "Schedule an upcoming inspection for a project",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id, name FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    return {
      success: true,
      action: "propose",
      inspection: {
        project: { id: project.id, name: project.name },
        type: params.type,
        date: params.date,
        scheduled_at: new Date().toISOString(),
      },
    };
  },
};

const generate_audit_trail = {
  riskLevel: "auto",
  description: "Generate a complete compliance audit trail for a project",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const permits = db
      .prepare("SELECT * FROM permits WHERE project_id = ? ORDER BY expiry_date")
      .all(params.project_id);
    const inspections = db
      .prepare("SELECT * FROM inspections WHERE project_id = ? ORDER BY date")
      .all(params.project_id);
    const failedInspections = inspections.filter(
      (i) => i.result === "fail" || i.result === "conditional",
    );

    return {
      success: true,
      audit: {
        project: { id: project.id, name: project.name, client: project.client },
        permits: {
          total: permits.length,
          approved: permits.filter((p) => p.status === "approved").length,
          pending: permits.filter((p) => p.status === "pending").length,
          expired: permits.filter((p) => p.status === "expired").length,
          items: permits,
        },
        inspections: {
          total: inspections.length,
          passed: inspections.filter((i) => i.result === "pass").length,
          failed_or_conditional: failedInspections.length,
          items: inspections,
        },
        compliance_score:
          inspections.length > 0
            ? (
                (inspections.filter((i) => i.result === "pass").length / inspections.length) *
                100
              ).toFixed(1) + "%"
            : "N/A",
        generated_at: new Date().toISOString(),
      },
    };
  },
};

// ─── Rapporteur (Reporting & Client Communication) ───────────────────────────

const get_project_summary = {
  riskLevel: "auto",
  description: "Get an aggregate project summary with all key data points",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const milestones = db
      .prepare(
        "SELECT status, COUNT(*) as count FROM milestones WHERE project_id = ? GROUP BY status",
      )
      .all(params.project_id);
    const totalMilestones = db
      .prepare("SELECT COUNT(*) as count FROM milestones WHERE project_id = ?")
      .get(params.project_id);
    const completedMilestones = db
      .prepare(
        "SELECT COUNT(*) as count FROM milestones WHERE project_id = ? AND status = 'completed'",
      )
      .get(params.project_id);
    const orders = db
      .prepare(
        "SELECT COUNT(*) as count, SUM(total) as total FROM purchase_orders WHERE project_id = ?",
      )
      .get(params.project_id);
    const inspections = db
      .prepare(
        "SELECT COUNT(*) as total, SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed FROM inspections WHERE project_id = ?",
      )
      .get(params.project_id);

    return {
      success: true,
      summary: {
        project,
        progress:
          totalMilestones.count > 0
            ? ((completedMilestones.count / totalMilestones.count) * 100).toFixed(1) + "%"
            : "0%",
        milestones_by_status: milestones,
        procurement: { orders: orders.count, total_spent: orders.total || 0 },
        inspections: { total: inspections.total, passed: inspections.passed },
        budget: {
          total: project.budget,
          spent: project.spent,
          remaining: project.budget ? project.budget - project.spent : null,
        },
      },
    };
  },
};

const list_site_photos = {
  riskLevel: "auto",
  description: "List site photo index for a project within a date range",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id, name FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const milestones = db
      .prepare(
        "SELECT id, name, phase, evidence FROM milestones WHERE project_id = ? AND evidence IS NOT NULL ORDER BY planned_date DESC",
      )
      .all(params.project_id);

    const photos = milestones.map((m) => ({
      milestone_id: m.id,
      milestone: m.name,
      phase: m.phase,
      evidence: m.evidence,
    }));

    return { success: true, project: project.name, photo_count: photos.length, photos };
  },
};

const reconcile_invoices = {
  riskLevel: "auto",
  description: "Match purchase orders against invoices for a project",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db
      .prepare("SELECT id, name, budget, spent FROM projects WHERE id = ?")
      .get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const orders = db
      .prepare("SELECT * FROM purchase_orders WHERE project_id = ? ORDER BY created_at DESC")
      .all(params.project_id);

    return {
      success: true,
      project: { id: project.id, name: project.name },
      orders_count: orders.length,
      total_ordered: orders.reduce((s, o) => s + o.total, 0),
      delivered: orders.filter((o) => o.status === "delivered").length,
      pending: orders.filter((o) => o.status !== "delivered").length,
      orders,
    };
  },
};

const draft_progress_report = {
  riskLevel: "auto",
  description: "Draft a project progress report",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    const milestones = db
      .prepare("SELECT * FROM milestones WHERE project_id = ? ORDER BY planned_date ASC")
      .all(params.project_id);
    const completed = milestones.filter((m) => m.status === "completed").length;
    const delayed = milestones.filter(
      (m) => m.status === "delayed" || m.status === "blocked",
    ).length;
    const recentInspections = db
      .prepare(
        "SELECT * FROM inspections WHERE project_id = ? AND date >= date('now', '-14 days') ORDER BY date DESC",
      )
      .all(params.project_id);

    return {
      success: true,
      report: {
        type: "progress_report",
        project: { id: project.id, name: project.name, client: project.client },
        period: "current",
        progress:
          milestones.length > 0 ? ((completed / milestones.length) * 100).toFixed(1) + "%" : "0%",
        milestones: {
          total: milestones.length,
          completed,
          delayed,
          upcoming: milestones.filter((m) => m.status === "pending").length,
        },
        budget: {
          total: project.budget,
          spent: project.spent,
          utilization: project.budget
            ? ((project.spent / project.budget) * 100).toFixed(1) + "%"
            : "N/A",
        },
        recent_inspections: recentInspections,
        generated_at: new Date().toISOString(),
      },
    };
  },
};

const generate_report_pdf = {
  riskLevel: "auto",
  description: "Generate PDF metadata for a project report",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db
      .prepare("SELECT id, name, client FROM projects WHERE id = ?")
      .get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    return {
      success: true,
      pdf: {
        project: project.name,
        client: project.client,
        filename: `report_${project.id}_${new Date().toISOString().split("T")[0]}.pdf`,
        generated_at: new Date().toISOString(),
      },
    };
  },
};

const draft_client_email = {
  riskLevel: "propose",
  description: "Draft a client communication email for a project",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db
      .prepare("SELECT id, name, client FROM projects WHERE id = ?")
      .get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    return {
      success: true,
      action: "propose",
      draft: {
        to: project.client,
        project: project.name,
        type: params.type,
        content: params.content,
        generated_at: new Date().toISOString(),
      },
    };
  },
};

const send_client_report = {
  riskLevel: "confirm",
  description: "Send a report to the client (requires confirmation)",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db
      .prepare("SELECT id, name, client FROM projects WHERE id = ?")
      .get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    return {
      success: true,
      action: "confirm",
      send: {
        project: project.name,
        client: project.client,
        report_id: params.report_id,
        requires_confirmation: true,
        prepared_at: new Date().toISOString(),
      },
    };
  },
};

const log_client_feedback = {
  riskLevel: "auto+",
  description: "Log client feedback for a project with priority",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const project = db.prepare("SELECT id, name FROM projects WHERE id = ?").get(params.project_id);
    if (!project) return { success: false, error: `Project ${params.project_id} not found` };

    return {
      success: true,
      feedback: {
        project: { id: project.id, name: project.name },
        feedback: params.feedback,
        priority: params.priority || "normal",
        logged_at: new Date().toISOString(),
      },
    };
  },
};

// ─── Export all tools ────────────────────────────────────────────────────────

module.exports = {
  // Chef de Projet
  list_milestones,
  get_project_timeline,
  detect_delays,
  update_milestone_status,
  allocate_resource,
  create_delay_alert,
  schedule_site_meeting,
  reassign_subcontractor,
  generate_weekly_snapshot,
  // Metreur
  list_open_rfqs,
  get_budget_vs_actual,
  search_supplier_catalog,
  create_rfq,
  compare_quotes,
  place_order,
  track_delivery,
  flag_budget_overrun,
  // Conformite
  list_permits,
  check_certifications,
  get_safety_checklist,
  flag_expiring_document,
  request_document,
  log_inspection: log_inspection_construction,
  schedule_inspection,
  generate_audit_trail,
  // Rapporteur
  get_project_summary,
  list_site_photos,
  reconcile_invoices,
  draft_progress_report,
  generate_report_pdf,
  draft_client_email,
  send_client_report,
  log_client_feedback,
};
