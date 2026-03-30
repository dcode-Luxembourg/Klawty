"use strict";

const { ensureVerticalSchema } = require("./vertical-db-schema");

let _schemaReady = false;

function _ensureSchema(db) {
  if (!_schemaReady) {
    ensureVerticalSchema(db, "real-estate");
    _schemaReady = true;
  }
}

// ─── Courtier (Lead & Sales) ─────────────────────────────────────────────────

const list_inquiries = {
  riskLevel: "auto",
  description: "List lead inquiries, optionally filtered by source or pipeline stage",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql = "SELECT * FROM leads WHERE 1=1";
    const args = [];
    if (params.source) {
      sql += " AND source = ?";
      args.push(params.source);
    }
    if (params.stage) {
      sql += " AND stage = ?";
      args.push(params.stage);
    }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, leads: rows };
  },
};

const score_lead = {
  riskLevel: "auto",
  description: "Calculate a lead score based on budget, timeline, and engagement signals",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(params.lead_id);
    if (!lead) return { success: false, error: `Lead ${params.lead_id} not found` };

    let score = 0;
    // Budget signals
    if (lead.budget_max && lead.budget_max > 0) score += 20;
    if (lead.budget_min && lead.budget_min > 0) score += 10;
    // Pipeline progression
    const stageScores = {
      new: 0,
      contacted: 10,
      qualified: 25,
      viewing: 40,
      offer: 60,
      negotiation: 75,
      won: 100,
      lost: 0,
    };
    score += stageScores[lead.stage] || 0;
    // Engagement
    if (lead.last_contact) {
      const daysSince = Math.floor((Date.now() - new Date(lead.last_contact).getTime()) / 86400000);
      if (daysSince <= 3) score += 15;
      else if (daysSince <= 7) score += 10;
      else if (daysSince <= 14) score += 5;
    }
    if (lead.email) score += 5;
    if (lead.phone) score += 5;
    score = Math.min(score, 100);

    return {
      success: true,
      lead_id: params.lead_id,
      score,
      breakdown: {
        budget: lead.budget_max ? "set" : "missing",
        stage: lead.stage,
        last_contact: lead.last_contact || "never",
      },
    };
  },
};

const assign_inquiry = {
  riskLevel: "auto+",
  description: "Assign a lead inquiry to a specific property",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(params.lead_id);
    if (!lead) return { success: false, error: `Lead ${params.lead_id} not found` };
    const prop = db
      .prepare("SELECT id, title FROM properties WHERE id = ?")
      .get(params.property_id);
    if (!prop) return { success: false, error: `Property ${params.property_id} not found` };

    db.prepare(
      "UPDATE leads SET assigned_property_id = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(params.property_id, params.lead_id);
    return {
      success: true,
      lead_id: params.lead_id,
      property_id: params.property_id,
      property_title: prop.title,
    };
  },
};

const create_viewing = {
  riskLevel: "auto+",
  description: "Schedule a property viewing for a lead",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const prop = db.prepare("SELECT id FROM properties WHERE id = ?").get(params.property_id);
    if (!prop) return { success: false, error: `Property ${params.property_id} not found` };
    const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(params.lead_id);
    if (!lead) return { success: false, error: `Lead ${params.lead_id} not found` };

    const result = db
      .prepare("INSERT INTO viewings (property_id, lead_id, date, time) VALUES (?, ?, ?, ?)")
      .run(params.property_id, params.lead_id, params.date, params.time);
    return {
      success: true,
      viewing_id: result.lastInsertRowid,
      property_id: params.property_id,
      lead_id: params.lead_id,
      date: params.date,
      time: params.time,
    };
  },
};

const send_followup = {
  riskLevel: "propose",
  description: "Generate a follow-up communication draft for a lead",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(params.lead_id);
    if (!lead) return { success: false, error: `Lead ${params.lead_id} not found` };

    const viewings = db
      .prepare(
        "SELECT v.*, p.title as property_title FROM viewings v JOIN properties p ON v.property_id = p.id WHERE v.lead_id = ? ORDER BY v.date DESC",
      )
      .all(params.lead_id);
    const property = lead.assigned_property_id
      ? db
          .prepare("SELECT title, price, area_sqm FROM properties WHERE id = ?")
          .get(lead.assigned_property_id)
      : null;

    return {
      success: true,
      action: "propose",
      draft: {
        to: lead.name,
        email: lead.email,
        subject: `Follow-up: ${property ? property.title : "Your property search"}`,
        context: {
          stage: lead.stage,
          viewings_count: viewings.length,
          last_viewing: viewings[0] || null,
          assigned_property: property,
        },
      },
    };
  },
};

const update_pipeline_stage = {
  riskLevel: "auto+",
  description: "Move a lead to a new pipeline stage with optional notes",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const lead = db.prepare("SELECT id, stage FROM leads WHERE id = ?").get(params.lead_id);
    if (!lead) return { success: false, error: `Lead ${params.lead_id} not found` };
    const validStages = [
      "new",
      "contacted",
      "qualified",
      "viewing",
      "offer",
      "negotiation",
      "won",
      "lost",
    ];
    if (!validStages.includes(params.stage))
      return { success: false, error: `Invalid stage: ${params.stage}` };

    const updates = ["stage = ?", "updated_at = datetime('now')"];
    const args = [params.stage];
    if (params.notes) {
      updates.push("notes = ?");
      args.push(params.notes);
    }
    args.push(params.lead_id);
    db.prepare(`UPDATE leads SET ${updates.join(", ")} WHERE id = ?`).run(...args);
    return {
      success: true,
      lead_id: params.lead_id,
      previous_stage: lead.stage,
      new_stage: params.stage,
    };
  },
};

const generate_lead_report = {
  riskLevel: "auto",
  description: "Generate an aggregate report of leads by stage, source, and period",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const period = params.period || "30";
    const cutoff = `datetime('now', '-${parseInt(period, 10)} days')`;

    const byStage = db
      .prepare(
        `SELECT stage, COUNT(*) as count FROM leads WHERE created_at >= ${cutoff} GROUP BY stage`,
      )
      .all();
    const bySource = db
      .prepare(
        `SELECT source, COUNT(*) as count FROM leads WHERE created_at >= ${cutoff} AND source IS NOT NULL GROUP BY source`,
      )
      .all();
    const total = db
      .prepare(`SELECT COUNT(*) as count FROM leads WHERE created_at >= ${cutoff}`)
      .get();
    const conversions = db
      .prepare(
        `SELECT COUNT(*) as count FROM leads WHERE stage = 'won' AND created_at >= ${cutoff}`,
      )
      .get();

    return {
      success: true,
      period_days: parseInt(period, 10),
      total: total.count,
      conversions: conversions.count,
      conversion_rate:
        total.count > 0 ? ((conversions.count / total.count) * 100).toFixed(1) + "%" : "0%",
      by_stage: byStage,
      by_source: bySource,
    };
  },
};

const create_offer_summary = {
  riskLevel: "propose",
  description: "Create an offer summary document for a lead and property",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(params.lead_id);
    if (!lead) return { success: false, error: `Lead ${params.lead_id} not found` };
    const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(params.property_id);
    if (!property) return { success: false, error: `Property ${params.property_id} not found` };

    return {
      success: true,
      action: "propose",
      summary: {
        type: "offer_summary",
        buyer: { name: lead.name, email: lead.email, phone: lead.phone },
        property: {
          id: property.id,
          title: property.title,
          address: property.address,
          asking_price: property.price,
          area_sqm: property.area_sqm,
        },
        offer: {
          amount: params.offer_amount,
          conditions: params.conditions || "None specified",
          price_vs_asking: property.price
            ? ((params.offer_amount / property.price) * 100).toFixed(1) + "%"
            : "N/A",
        },
        generated_at: new Date().toISOString(),
      },
    };
  },
};

// ─── Cadastre (Property & Portfolio) ─────────────────────────────────────────

const list_properties = {
  riskLevel: "auto",
  description: "List properties, optionally filtered by status or type",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql = "SELECT * FROM properties WHERE 1=1";
    const args = [];
    if (params.status) {
      sql += " AND status = ?";
      args.push(params.status);
    }
    if (params.type) {
      sql += " AND type = ?";
      args.push(params.type);
    }
    sql += " ORDER BY updated_at DESC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, properties: rows };
  },
};

const sync_listing = {
  riskLevel: "auto+",
  description: "Mark a property as synced to external listing portals",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const prop = db
      .prepare("SELECT id, title FROM properties WHERE id = ?")
      .get(params.property_id);
    if (!prop) return { success: false, error: `Property ${params.property_id} not found` };

    db.prepare(
      "UPDATE properties SET portal_synced = 1, updated_at = datetime('now') WHERE id = ?",
    ).run(params.property_id);
    return {
      success: true,
      property_id: params.property_id,
      title: prop.title,
      portal_synced: true,
    };
  },
};

const update_listing = {
  riskLevel: "auto+",
  description: "Update property listing details",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const prop = db.prepare("SELECT id FROM properties WHERE id = ?").get(params.property_id);
    if (!prop) return { success: false, error: `Property ${params.property_id} not found` };

    const allowed = [
      "title",
      "type",
      "address",
      "city",
      "price",
      "price_per_sqm",
      "area_sqm",
      "rooms",
      "status",
      "mandate_type",
      "cpe_status",
      "photos_count",
    ];
    const sets = [];
    const args = [];
    for (const key of allowed) {
      if (params.updates && params.updates[key] !== undefined) {
        sets.push(`${key} = ?`);
        args.push(params.updates[key]);
      }
    }
    if (sets.length === 0) return { success: false, error: "No valid fields to update" };
    sets.push("updated_at = datetime('now')");
    args.push(params.property_id);
    db.prepare(`UPDATE properties SET ${sets.join(", ")} WHERE id = ?`).run(...args);
    return {
      success: true,
      property_id: params.property_id,
      updated_fields: Object.keys(params.updates || {}).filter((k) => allowed.includes(k)),
    };
  },
};

const track_lease = {
  riskLevel: "auto",
  description: "List leases, optionally filtered by property",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql =
      "SELECT l.*, p.title as property_title, p.address FROM leases l JOIN properties p ON l.property_id = p.id WHERE 1=1";
    const args = [];
    if (params.property_id) {
      sql += " AND l.property_id = ?";
      args.push(params.property_id);
    }
    sql += " ORDER BY l.end_date ASC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, leases: rows };
  },
};

const alert_renewal = {
  riskLevel: "auto",
  description: "Find leases expiring within N days",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const days = params.days || 90;
    const rows = db
      .prepare(
        `SELECT l.*, p.title as property_title, p.address
       FROM leases l JOIN properties p ON l.property_id = p.id
       WHERE l.end_date IS NOT NULL
       AND l.end_date <= datetime('now', '+' || ? || ' days')
       AND l.status IN ('active', 'expiring')
       ORDER BY l.end_date ASC`,
      )
      .all(days);
    return { success: true, days_threshold: days, count: rows.length, expiring_leases: rows };
  },
};

const generate_mandate = {
  riskLevel: "propose",
  description: "Generate a mandate document draft for a property",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(params.property_id);
    if (!property) return { success: false, error: `Property ${params.property_id} not found` };

    return {
      success: true,
      action: "propose",
      mandate: {
        type: "mandate_draft",
        property: {
          id: property.id,
          title: property.title,
          address: property.address,
          city: property.city,
          price: property.price,
          area_sqm: property.area_sqm,
          type: property.type,
        },
        mandate_type: property.mandate_type || "exclusive",
        generated_at: new Date().toISOString(),
      },
    };
  },
};

const archive_document = {
  riskLevel: "auto+",
  description: "Archive a property document by type and reference",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const prop = db
      .prepare("SELECT id, title FROM properties WHERE id = ?")
      .get(params.property_id);
    if (!prop) return { success: false, error: `Property ${params.property_id} not found` };

    return {
      success: true,
      property_id: params.property_id,
      property_title: prop.title,
      doc_type: params.doc_type,
      ref: params.ref,
      archived_at: new Date().toISOString(),
    };
  },
};

const check_compliance = {
  riskLevel: "auto",
  description: "Check regulatory compliance for a property (CPE, mandate, photos)",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(params.property_id);
    if (!property) return { success: false, error: `Property ${params.property_id} not found` };

    const issues = [];
    if (!property.cpe_status || property.cpe_status === "missing")
      issues.push("CPE/EPC certificate missing or not provided");
    if (!property.mandate_signed) issues.push("Mandate not signed");
    if (property.photos_count < 5)
      issues.push(`Only ${property.photos_count} photos (minimum 5 recommended)`);
    if (!property.price) issues.push("Price not set");

    return {
      success: true,
      property_id: params.property_id,
      compliant: issues.length === 0,
      issues,
      checks: {
        cpe_status: property.cpe_status || "missing",
        mandate_signed: !!property.mandate_signed,
        photos_count: property.photos_count,
        price_set: !!property.price,
      },
    };
  },
};

const produce_owner_report = {
  riskLevel: "propose",
  description:
    "Produce a comprehensive owner report for a property with viewings, leads, and market data",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(params.property_id);
    if (!property) return { success: false, error: `Property ${params.property_id} not found` };

    const viewings = db
      .prepare("SELECT * FROM viewings WHERE property_id = ? ORDER BY date DESC")
      .all(params.property_id);
    const leads = db
      .prepare("SELECT * FROM leads WHERE assigned_property_id = ?")
      .all(params.property_id);
    const leases = db.prepare("SELECT * FROM leases WHERE property_id = ?").all(params.property_id);
    const comparables = db
      .prepare(
        "SELECT id, title, price, area_sqm, price_per_sqm, status FROM properties WHERE city = ? AND type = ? AND id != ? LIMIT 5",
      )
      .all(property.city || "", property.type || "", params.property_id);

    return {
      success: true,
      action: "propose",
      report: {
        property: {
          id: property.id,
          title: property.title,
          address: property.address,
          price: property.price,
          days_on_market: property.days_on_market,
          status: property.status,
        },
        activity: {
          total_viewings: viewings.length,
          recent_viewings: viewings.slice(0, 5),
          total_leads: leads.length,
          active_leads: leads.filter((l) => !["won", "lost"].includes(l.stage)).length,
        },
        leases: {
          count: leases.length,
          active: leases.filter((l) => l.status === "active").length,
        },
        market: { comparables_count: comparables.length, comparables },
        generated_at: new Date().toISOString(),
      },
    };
  },
};

// ─── Vigie (Market Intelligence) ─────────────────────────────────────────────

const scan_market_prices = {
  riskLevel: "auto",
  description: "Scan market prices for a given zone and property type",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql =
      "SELECT city, type, COUNT(*) as count, AVG(price) as avg_price, AVG(price_per_sqm) as avg_price_per_sqm, MIN(price) as min_price, MAX(price) as max_price FROM properties WHERE status = 'active'";
    const args = [];
    if (params.zone) {
      sql += " AND city = ?";
      args.push(params.zone);
    }
    if (params.type) {
      sql += " AND type = ?";
      args.push(params.type);
    }
    sql += " GROUP BY city, type ORDER BY count DESC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, zones: rows, scanned_at: new Date().toISOString() };
  },
};

const run_comparable_analysis = {
  riskLevel: "auto",
  description: "Find comparable properties for valuation analysis",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(params.property_id);
    if (!property) return { success: false, error: `Property ${params.property_id} not found` };

    const comparables = db
      .prepare(
        `SELECT id, title, price, area_sqm, price_per_sqm, rooms, status, days_on_market
       FROM properties
       WHERE city = ? AND type = ? AND id != ?
       AND area_sqm BETWEEN ? AND ?
       ORDER BY ABS(area_sqm - ?) ASC LIMIT 10`,
      )
      .all(
        property.city || "",
        property.type || "",
        params.property_id,
        (property.area_sqm || 0) * 0.7,
        (property.area_sqm || 0) * 1.3,
        property.area_sqm || 0,
      );

    const avgPrice =
      comparables.length > 0
        ? comparables.reduce((s, c) => s + (c.price || 0), 0) / comparables.length
        : null;
    const avgPpsm =
      comparables.length > 0
        ? comparables.reduce((s, c) => s + (c.price_per_sqm || 0), 0) / comparables.length
        : null;

    return {
      success: true,
      subject: {
        id: property.id,
        title: property.title,
        price: property.price,
        price_per_sqm: property.price_per_sqm,
      },
      comparables_count: comparables.length,
      comparables,
      market_avg_price: avgPrice,
      market_avg_price_per_sqm: avgPpsm,
    };
  },
};

const track_price_history = {
  riskLevel: "auto",
  description: "Track price change history for a property",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const property = db
      .prepare(
        "SELECT id, title, price, price_per_sqm, created_at, updated_at FROM properties WHERE id = ?",
      )
      .get(params.property_id);
    if (!property) return { success: false, error: `Property ${params.property_id} not found` };

    return {
      success: true,
      property_id: params.property_id,
      title: property.title,
      current_price: property.price,
      current_price_per_sqm: property.price_per_sqm,
      listed_at: property.created_at,
      last_updated: property.updated_at,
    };
  },
};

const generate_market_report = {
  riskLevel: "auto",
  description: "Generate an aggregate market report for a zone",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let whereClause = "WHERE 1=1";
    const args = [];
    if (params.zone) {
      whereClause += " AND city = ?";
      args.push(params.zone);
    }

    const summary = db
      .prepare(
        `SELECT COUNT(*) as total, AVG(price) as avg_price, AVG(price_per_sqm) as avg_ppsm, AVG(days_on_market) as avg_dom FROM properties ${whereClause} AND status = 'active'`,
      )
      .get(...args);
    const byType = db
      .prepare(
        `SELECT type, COUNT(*) as count, AVG(price) as avg_price, AVG(price_per_sqm) as avg_ppsm FROM properties ${whereClause} AND status = 'active' GROUP BY type`,
      )
      .all(...args);
    const byStatus = db
      .prepare(`SELECT status, COUNT(*) as count FROM properties ${whereClause} GROUP BY status`)
      .all(...args);
    const recentSales = db
      .prepare(
        `SELECT id, title, price, area_sqm, price_per_sqm, updated_at FROM properties ${whereClause} AND status IN ('sold', 'rented') ORDER BY updated_at DESC LIMIT 10`,
      )
      .all(...args);

    return {
      success: true,
      zone: params.zone || "all",
      summary,
      by_type: byType,
      by_status: byStatus,
      recent_transactions: recentSales,
      generated_at: new Date().toISOString(),
    };
  },
};

const detect_opportunity = {
  riskLevel: "auto",
  description: "Detect underpriced properties based on market comparison",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const threshold = params.threshold || 15;

    const properties = db
      .prepare(
        `SELECT p.*, (SELECT AVG(p2.price_per_sqm) FROM properties p2 WHERE p2.city = p.city AND p2.type = p.type AND p2.status = 'active' AND p2.id != p.id) as market_avg_ppsm
       FROM properties p WHERE p.status = 'active' AND p.price_per_sqm IS NOT NULL`,
      )
      .all();

    const opportunities = properties
      .filter((p) => {
        if (!p.market_avg_ppsm || p.market_avg_ppsm === 0) return false;
        const discount = ((p.market_avg_ppsm - p.price_per_sqm) / p.market_avg_ppsm) * 100;
        return discount >= threshold;
      })
      .map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        price_per_sqm: p.price_per_sqm,
        market_avg_ppsm: Math.round(p.market_avg_ppsm * 100) / 100,
        discount_pct:
          Math.round(((p.market_avg_ppsm - p.price_per_sqm) / p.market_avg_ppsm) * 10000) / 100,
        city: p.city,
        type: p.type,
      }));

    return {
      success: true,
      threshold_pct: threshold,
      opportunities_found: opportunities.length,
      opportunities,
    };
  },
};

const estimate_valuation = {
  riskLevel: "propose",
  description: "Estimate property valuation based on comparables with confidence level",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(params.property_id);
    if (!property) return { success: false, error: `Property ${params.property_id} not found` };

    const comparables = db
      .prepare(
        `SELECT price, price_per_sqm, area_sqm FROM properties
       WHERE city = ? AND type = ? AND id != ? AND status IN ('active', 'sold', 'rented')
       AND area_sqm BETWEEN ? AND ?`,
      )
      .all(
        property.city || "",
        property.type || "",
        params.property_id,
        (property.area_sqm || 0) * 0.7,
        (property.area_sqm || 0) * 1.3,
      );

    if (comparables.length === 0) {
      return {
        success: true,
        action: "propose",
        property_id: params.property_id,
        valuation: null,
        confidence: "none",
        reason: "No comparable properties found",
      };
    }

    const avgPpsm =
      comparables.reduce((s, c) => s + (c.price_per_sqm || 0), 0) / comparables.length;
    const estimated = Math.round(avgPpsm * (property.area_sqm || 0));
    const confidence =
      comparables.length >= 5 ? "high" : comparables.length >= 3 ? "medium" : "low";

    return {
      success: true,
      action: "propose",
      valuation: {
        estimated_value: estimated,
        estimated_ppsm: Math.round(avgPpsm * 100) / 100,
        comparables_used: comparables.length,
        confidence,
        current_listed_price: property.price,
        delta: property.price ? estimated - property.price : null,
      },
    };
  },
};

const publish_market_briefing = {
  riskLevel: "auto",
  description: "Produce a weekly market briefing summary",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);

    const newListings = db
      .prepare(
        "SELECT COUNT(*) as count FROM properties WHERE created_at >= datetime('now', '-7 days')",
      )
      .get();
    const closedDeals = db
      .prepare(
        "SELECT COUNT(*) as count, AVG(price) as avg_price FROM properties WHERE status IN ('sold', 'rented') AND updated_at >= datetime('now', '-7 days')",
      )
      .get();
    const activeCount = db
      .prepare("SELECT COUNT(*) as count FROM properties WHERE status = 'active'")
      .get();
    const newLeads = db
      .prepare("SELECT COUNT(*) as count FROM leads WHERE created_at >= datetime('now', '-7 days')")
      .get();
    const viewingsThisWeek = db
      .prepare("SELECT COUNT(*) as count FROM viewings WHERE date >= date('now', '-7 days')")
      .get();

    return {
      success: true,
      briefing: {
        period: "last_7_days",
        new_listings: newListings.count,
        closed_deals: closedDeals.count,
        avg_deal_price: closedDeals.avg_price,
        active_listings: activeCount.count,
        new_leads: newLeads.count,
        viewings: viewingsThisWeek.count,
        generated_at: new Date().toISOString(),
      },
    };
  },
};

// ─── Concierge (Property Management) ─────────────────────────────────────────

const list_maintenance_requests = {
  riskLevel: "auto",
  description: "List maintenance requests, optionally filtered by status or severity",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    let sql =
      "SELECT mt.*, p.title as property_title, p.address FROM maintenance_tickets mt JOIN properties p ON mt.property_id = p.id WHERE 1=1";
    const args = [];
    if (params.status) {
      sql += " AND mt.status = ?";
      args.push(params.status);
    }
    if (params.severity) {
      sql += " AND mt.severity = ?";
      args.push(params.severity);
    }
    sql +=
      " ORDER BY CASE mt.severity WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, mt.created_at DESC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, tickets: rows };
  },
};

const create_maintenance_ticket = {
  riskLevel: "auto+",
  description: "Create a new maintenance ticket for a property",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const prop = db.prepare("SELECT id FROM properties WHERE id = ?").get(params.property_id);
    if (!prop) return { success: false, error: `Property ${params.property_id} not found` };
    const validSeverity = ["low", "normal", "urgent", "emergency"];
    if (!validSeverity.includes(params.severity))
      return { success: false, error: `Invalid severity: ${params.severity}` };

    const result = db
      .prepare(
        "INSERT INTO maintenance_tickets (property_id, tenant_name, category, severity, description) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        params.property_id,
        params.tenant_name,
        params.category,
        params.severity,
        params.description,
      );
    return {
      success: true,
      ticket_id: result.lastInsertRowid,
      property_id: params.property_id,
      severity: params.severity,
    };
  },
};

const route_to_contractor = {
  riskLevel: "propose",
  description: "Assign a maintenance ticket to a contractor",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const ticket = db
      .prepare("SELECT * FROM maintenance_tickets WHERE id = ?")
      .get(params.ticket_id);
    if (!ticket) return { success: false, error: `Ticket ${params.ticket_id} not found` };

    db.prepare(
      "UPDATE maintenance_tickets SET contractor = ?, status = 'assigned', resolved_at = NULL WHERE id = ?",
    ).run(params.contractor, params.ticket_id);
    return {
      success: true,
      action: "propose",
      ticket_id: params.ticket_id,
      contractor: params.contractor,
      previous_status: ticket.status,
    };
  },
};

const send_tenant_notice = {
  riskLevel: "propose",
  description: "Draft a notice for a tenant (rent reminder, maintenance update, etc.)",
  isWriteTool: true,
  execute: async (params, context) => {
    return {
      success: true,
      action: "propose",
      draft: {
        to: params.tenant_name,
        type: params.type,
        content: params.content,
        generated_at: new Date().toISOString(),
      },
    };
  },
};

const track_rent_payments = {
  riskLevel: "auto",
  description: "Track rent payment status for a given month",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const month = params.month || new Date().toISOString().slice(0, 7);

    const leases = db
      .prepare(
        `SELECT l.*, p.title as property_title, p.address
       FROM leases l JOIN properties p ON l.property_id = p.id
       WHERE l.status = 'active'
       ORDER BY l.tenant_name`,
      )
      .all();

    return {
      success: true,
      month,
      active_leases: leases.length,
      leases: leases.map((l) => ({
        lease_id: l.id,
        tenant: l.tenant_name,
        property: l.property_title,
        rent: l.rent_amount,
        deposit: l.deposit_amount,
      })),
    };
  },
};

const generate_rent_reminder = {
  riskLevel: "auto",
  description: "Generate a rent reminder draft for a lease",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const lease = db
      .prepare(
        "SELECT l.*, p.title as property_title FROM leases l JOIN properties p ON l.property_id = p.id WHERE l.id = ?",
      )
      .get(params.lease_id);
    if (!lease) return { success: false, error: `Lease ${params.lease_id} not found` };

    return {
      success: true,
      reminder: {
        tenant: lease.tenant_name,
        email: lease.tenant_email,
        property: lease.property_title,
        rent_amount: lease.rent_amount,
        generated_at: new Date().toISOString(),
      },
    };
  },
};

const log_inspection = {
  riskLevel: "auto+",
  description: "Log a property inspection result",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const prop = db
      .prepare("SELECT id, title FROM properties WHERE id = ?")
      .get(params.property_id);
    if (!prop) return { success: false, error: `Property ${params.property_id} not found` };

    return {
      success: true,
      property_id: params.property_id,
      property_title: prop.title,
      result: params.result,
      notes: params.notes || "",
      logged_at: new Date().toISOString(),
    };
  },
};

const process_move_in_out = {
  riskLevel: "propose",
  description: "Process a move-in or move-out with checklist generation",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    _ensureSchema(db);
    const prop = db
      .prepare("SELECT id, title, address FROM properties WHERE id = ?")
      .get(params.property_id);
    if (!prop) return { success: false, error: `Property ${params.property_id} not found` };

    const checklist =
      params.type === "move_in"
        ? [
            "Key handover",
            "Meter readings (electricity, gas, water)",
            "Property condition report",
            "Inventory check",
            "Deposit receipt",
            "Welcome pack",
            "Emergency contacts",
            "Building rules",
          ]
        : [
            "Key return",
            "Meter readings (final)",
            "Property condition report",
            "Damage assessment",
            "Deposit return calculation",
            "Forwarding address",
            "Utility cancellation",
            "Final cleaning",
          ];

    return {
      success: true,
      action: "propose",
      process: {
        type: params.type,
        property: { id: prop.id, title: prop.title, address: prop.address },
        tenant: params.tenant_name,
        checklist: checklist.map((item) => ({ item, completed: false })),
        generated_at: new Date().toISOString(),
      },
    };
  },
};

// ─── Export all tools ────────────────────────────────────────────────────────

module.exports = {
  // Courtier
  list_inquiries,
  score_lead,
  assign_inquiry,
  create_viewing,
  send_followup,
  update_pipeline_stage,
  generate_lead_report,
  create_offer_summary,
  // Cadastre
  list_properties,
  sync_listing,
  update_listing,
  track_lease,
  alert_renewal,
  generate_mandate,
  archive_document,
  check_compliance,
  produce_owner_report,
  // Vigie
  scan_market_prices,
  run_comparable_analysis,
  track_price_history,
  generate_market_report,
  detect_opportunity,
  estimate_valuation,
  publish_market_briefing,
  // Concierge
  list_maintenance_requests,
  create_maintenance_ticket,
  route_to_contractor,
  send_tenant_notice,
  track_rent_payments,
  generate_rent_reminder,
  log_inspection,
  process_move_in_out,
};
