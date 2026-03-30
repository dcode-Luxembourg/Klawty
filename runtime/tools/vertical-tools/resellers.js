"use strict";

/**
 * Resellers Vertical Tools
 *
 * 25 tools across 3 agents: Catalogueur, Prospecteur, Fidelite
 * Tables: products, quotes, pipeline, warranties, competitor_prices
 */

const { ensureVerticalSchema } = require("./vertical-db-schema");

let _schemaReady = false;

function initSchema(db) {
  if (_schemaReady) return;
  ensureVerticalSchema(db, "resellers");
  _schemaReady = true;
}

// ---------------------------------------------------------------------------
// Catalogueur tools
// ---------------------------------------------------------------------------

const sync_inventory = {
  riskLevel: "auto",
  description: "Sync and report current inventory status",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const total = db.prepare("SELECT COUNT(*) as count FROM products WHERE archived = 0").get();
    const lowStock = db
      .prepare(
        "SELECT COUNT(*) as count FROM products WHERE stock_level <= reorder_point AND archived = 0",
      )
      .get();
    const outOfStock = db
      .prepare("SELECT COUNT(*) as count FROM products WHERE stock_level = 0 AND archived = 0")
      .get();
    const unsynced = db
      .prepare("SELECT COUNT(*) as count FROM products WHERE channel_synced = 0 AND archived = 0")
      .get();
    return {
      success: true,
      sync_status: {
        total_products: total.count,
        low_stock: lowStock.count,
        out_of_stock: outOfStock.count,
        unsynced_channels: unsynced.count,
        synced_at: new Date().toISOString(),
      },
    };
  },
};

const update_product_price = {
  riskLevel: "propose",
  description: "Update a product sell price and recalculate margin",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { sku, new_price } = params;
    if (!sku || new_price == null) return { success: false, error: "Missing sku or new_price" };
    const product = db.prepare("SELECT * FROM products WHERE sku = ?").get(sku);
    if (!product) return { success: false, error: `Product not found: ${sku}` };
    const old_price = product.sell_price;
    const margin = product.cost_price
      ? (((new_price - product.cost_price) / new_price) * 100).toFixed(1)
      : null;
    db.prepare(
      `UPDATE products SET sell_price = ?, channel_synced = 0, updated_at = datetime('now') WHERE sku = ?`,
    ).run(new_price, sku);
    return {
      success: true,
      sku,
      old_price,
      new_price,
      margin_pct: margin ? parseFloat(margin) : null,
      cost_price: product.cost_price,
    };
  },
};

const create_reorder_alert = {
  riskLevel: "auto",
  description: "Generate reorder alerts for products at or below reorder point",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const rows = db
      .prepare(
        `SELECT sku, name, category, supplier, stock_level, reorder_point,
         (reorder_point - stock_level) as deficit
       FROM products
       WHERE stock_level <= reorder_point AND archived = 0
       ORDER BY deficit DESC`,
      )
      .all();
    return { success: true, count: rows.length, alerts: rows };
  },
};

const calculate_margins = {
  riskLevel: "auto",
  description: "Calculate margins for products, optionally filtered by category",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    let sql = `SELECT sku, name, category, cost_price, sell_price,
         CASE WHEN sell_price > 0 THEN ROUND((sell_price - cost_price) / sell_price * 100, 1) ELSE 0 END as margin_pct
       FROM products WHERE archived = 0 AND cost_price IS NOT NULL AND sell_price IS NOT NULL`;
    const args = [];
    if (params.category) {
      sql += " AND category = ?";
      args.push(params.category);
    }
    sql += " ORDER BY margin_pct ASC";
    const rows = db.prepare(sql).all(...args);
    const avg =
      rows.length > 0
        ? (rows.reduce((s, r) => s + r.margin_pct, 0) / rows.length).toFixed(1)
        : "0.0";
    return { success: true, count: rows.length, avg_margin_pct: parseFloat(avg), products: rows };
  },
};

const monitor_supplier_feed = {
  riskLevel: "auto",
  description: "Check supplier feed status for inventory updates",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const suppliers = db
      .prepare(
        `SELECT supplier, COUNT(*) as product_count,
         MAX(updated_at) as last_update
       FROM products WHERE archived = 0 AND supplier IS NOT NULL
       GROUP BY supplier ORDER BY last_update ASC`,
      )
      .all();
    return {
      success: true,
      feeds: suppliers,
      checked_at: new Date().toISOString(),
      note: "Feed freshness based on last product update per supplier",
    };
  },
};

const apply_bulk_price_rule = {
  riskLevel: "propose",
  description: "Apply a bulk pricing rule to all products in a category",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { category, rule_type, value } = params;
    if (!category || !rule_type || value == null) {
      return { success: false, error: "Missing category, rule_type, or value" };
    }
    let sql;
    if (rule_type === "markup_pct") {
      sql = `UPDATE products SET sell_price = ROUND(cost_price * (1 + ? / 100.0), 2), channel_synced = 0, updated_at = datetime('now')
             WHERE category = ? AND archived = 0 AND cost_price IS NOT NULL`;
    } else if (rule_type === "fixed_margin") {
      sql = `UPDATE products SET sell_price = ROUND(cost_price + ?, 2), channel_synced = 0, updated_at = datetime('now')
             WHERE category = ? AND archived = 0 AND cost_price IS NOT NULL`;
    } else if (rule_type === "discount_pct") {
      sql = `UPDATE products SET sell_price = ROUND(sell_price * (1 - ? / 100.0), 2), channel_synced = 0, updated_at = datetime('now')
             WHERE category = ? AND archived = 0 AND sell_price IS NOT NULL`;
    } else {
      return {
        success: false,
        error: `Unknown rule_type: ${rule_type}. Use markup_pct, fixed_margin, or discount_pct`,
      };
    }
    const result = db.prepare(sql).run(value, category);
    return { success: true, rule_type, value, category, products_updated: result.changes };
  },
};

const flag_dead_stock = {
  riskLevel: "auto",
  description: "Flag products with no sales in N days (default 90)",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const days = params.days || 90;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const rows = db
      .prepare(
        `SELECT sku, name, category, stock_level, sell_price, last_sold,
         CAST(julianday('now') - julianday(COALESCE(last_sold, '2000-01-01')) AS INTEGER) as days_since_sale
       FROM products
       WHERE archived = 0 AND stock_level > 0
         AND (last_sold IS NULL OR last_sold < ?)
       ORDER BY days_since_sale DESC`,
      )
      .all(cutoff);
    return { success: true, threshold_days: days, count: rows.length, dead_stock: rows };
  },
};

const generate_catalog_export = {
  riskLevel: "auto",
  description: "Generate a catalog export of all active products",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const rows = db
      .prepare(
        `SELECT sku, name, category, supplier, cost_price, sell_price, stock_level
       FROM products WHERE archived = 0 ORDER BY category, name`,
      )
      .all();
    const format = params.format || "json";
    return {
      success: true,
      format,
      count: rows.length,
      products: rows,
      exported_at: new Date().toISOString(),
    };
  },
};

// ---------------------------------------------------------------------------
// Prospecteur tools
// ---------------------------------------------------------------------------

const qualify_lead = {
  riskLevel: "auto+",
  description: "Qualify and score a new lead, add to pipeline",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { company, contact, email, source, estimated_value } = params;
    if (!company || !contact || !email) {
      return { success: false, error: "Missing required fields: company, contact, email" };
    }
    let score = 30;
    if (estimated_value && estimated_value > 5000) score += 20;
    if (estimated_value && estimated_value > 20000) score += 15;
    if (source === "referral") score += 20;
    else if (source === "website") score += 10;
    if (email && email.includes("@gmail") === false && email.includes("@yahoo") === false)
      score += 10;
    score = Math.min(score, 100);
    const result = db
      .prepare(
        `INSERT INTO pipeline (company, contact, email, source, score, stage, estimated_value, last_contact)
       VALUES (?, ?, ?, ?, ?, 'new', ?, datetime('now'))`,
      )
      .run(company, contact, email, source || null, score, estimated_value || null);
    return { success: true, deal_id: result.lastInsertRowid, score, stage: "new" };
  },
};

const generate_quote = {
  riskLevel: "propose",
  description: "Generate a quote for a lead with margin calculation",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { lead_name, items, lead_email } = params;
    if (!lead_name || !items) return { success: false, error: "Missing lead_name or items" };
    const itemsStr = typeof items === "string" ? items : JSON.stringify(items);
    let total = 0;
    let totalCost = 0;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.sku) {
          const product = db
            .prepare("SELECT cost_price, sell_price FROM products WHERE sku = ?")
            .get(item.sku);
          if (product) {
            const qty = item.quantity || 1;
            total += (product.sell_price || 0) * qty;
            totalCost += (product.cost_price || 0) * qty;
          }
        } else if (item.price) {
          total += item.price * (item.quantity || 1);
        }
      }
    }
    const margin_pct = total > 0 ? (((total - totalCost) / total) * 100).toFixed(1) : null;
    const validUntil = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const result = db
      .prepare(
        `INSERT INTO quotes (lead_name, lead_email, items, total, margin_pct, status, valid_until)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      )
      .run(
        lead_name,
        lead_email || null,
        itemsStr,
        total,
        margin_pct ? parseFloat(margin_pct) : null,
        validUntil,
      );
    return {
      success: true,
      quote_id: result.lastInsertRowid,
      total,
      margin_pct: margin_pct ? parseFloat(margin_pct) : null,
      valid_until: validUntil,
    };
  },
};

const track_pipeline_stage = {
  riskLevel: "auto+",
  description: "Update a deal stage in the pipeline",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { deal_id, stage, notes } = params;
    if (!deal_id || !stage) return { success: false, error: "Missing deal_id or stage" };
    const result = db
      .prepare(
        `UPDATE pipeline SET stage = ?, notes = COALESCE(?, notes), last_contact = datetime('now') WHERE id = ?`,
      )
      .run(stage, notes || null, deal_id);
    return { success: true, deal_id, new_stage: stage, changes: result.changes };
  },
};

const monitor_competitor_prices = {
  riskLevel: "auto",
  description: "Monitor competitor prices for a specific SKU or all tracked products",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    let sql = `SELECT cp.*, p.sell_price as our_price,
         CASE WHEN p.sell_price > 0 THEN ROUND((cp.price - p.sell_price) / p.sell_price * 100, 1) ELSE NULL END as price_diff_pct
       FROM competitor_prices cp
       LEFT JOIN products p ON cp.product_sku = p.sku`;
    const args = [];
    if (params.sku) {
      sql += " WHERE cp.product_sku = ?";
      args.push(params.sku);
    }
    sql += " ORDER BY cp.checked_at DESC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, competitor_prices: rows };
  },
};

const draft_followup = {
  riskLevel: "auto+",
  description: "Draft a follow-up message for a pipeline deal",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { deal_id } = params;
    if (!deal_id) return { success: false, error: "Missing deal_id" };
    const deal = db.prepare("SELECT * FROM pipeline WHERE id = ?").get(deal_id);
    if (!deal) return { success: false, error: "Deal not found" };
    const templates = {
      new: `Hi ${deal.contact},\n\nThank you for your interest. I'd love to learn more about your needs at ${deal.company}. Could we schedule a brief call this week?\n\nBest regards`,
      contacted: `Hi ${deal.contact},\n\nFollowing up on our recent conversation. I've prepared some options that might be a great fit for ${deal.company}. Would you like me to send over a detailed quote?\n\nBest regards`,
      quoted: `Hi ${deal.contact},\n\nI wanted to check in on the quote we sent over. Do you have any questions or would you like to discuss any adjustments?\n\nBest regards`,
      negotiation: `Hi ${deal.contact},\n\nI appreciate the ongoing discussion. I believe we can find terms that work well for both sides. Shall we schedule a call to finalize?\n\nBest regards`,
    };
    const draft =
      templates[deal.stage] ||
      `Hi ${deal.contact},\n\nJust checking in regarding our discussion. Please let me know if there's anything I can help with.\n\nBest regards`;
    return { success: true, deal, draft_message: draft };
  },
};

const check_credit_risk = {
  riskLevel: "auto",
  description: "Check credit risk based on payment history in the pipeline",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { company } = params;
    if (!company) return { success: false, error: "Missing company name" };
    const deals = db
      .prepare(
        `SELECT stage, COUNT(*) as count, SUM(estimated_value) as total_value
       FROM pipeline WHERE company = ? GROUP BY stage`,
      )
      .all(company);
    const wonDeals = deals.find((d) => d.stage === "won");
    const lostDeals = deals.find((d) => d.stage === "lost");
    const totalDeals = deals.reduce((s, d) => s + d.count, 0);
    let risk = "unknown";
    if (totalDeals === 0) risk = "no_history";
    else if (wonDeals && wonDeals.count > 2) risk = "low";
    else if (lostDeals && lostDeals.count > wonDeals?.count) risk = "elevated";
    else risk = "moderate";
    return {
      success: true,
      company,
      risk_level: risk,
      deal_history: deals,
      total_deals: totalDeals,
    };
  },
};

const log_lost_deal = {
  riskLevel: "auto+",
  description: "Mark a deal as lost with a reason",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { deal_id, reason } = params;
    if (!deal_id || !reason) return { success: false, error: "Missing deal_id or reason" };
    const result = db
      .prepare(
        `UPDATE pipeline SET stage = 'lost', notes = COALESCE(notes || ' | ', '') || ?, last_contact = datetime('now') WHERE id = ?`,
      )
      .run(`Lost: ${reason}`, deal_id);
    return { success: true, deal_id, reason, changes: result.changes };
  },
};

const generate_sales_report = {
  riskLevel: "auto",
  description: "Generate an aggregate sales pipeline report",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const byStage = db
      .prepare(
        `SELECT stage, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as total_value
       FROM pipeline GROUP BY stage ORDER BY stage`,
      )
      .all();
    const topDeals = db
      .prepare(
        `SELECT company, contact, stage, estimated_value, score
       FROM pipeline WHERE stage NOT IN ('won', 'lost')
       ORDER BY estimated_value DESC LIMIT 10`,
      )
      .all();
    const quoteStats = db
      .prepare(
        `SELECT status, COUNT(*) as count, SUM(total) as total_value
       FROM quotes GROUP BY status`,
      )
      .all();
    return {
      success: true,
      pipeline_by_stage: byStage,
      top_open_deals: topDeals,
      quote_stats: quoteStats,
    };
  },
};

const schedule_callback = {
  riskLevel: "auto+",
  description: "Schedule a callback reminder for a deal",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { deal_id, date, time } = params;
    if (!deal_id || !date || !time)
      return { success: false, error: "Missing deal_id, date, or time" };
    const deal = db.prepare("SELECT company, contact FROM pipeline WHERE id = ?").get(deal_id);
    if (!deal) return { success: false, error: "Deal not found" };
    return {
      success: true,
      reminder: {
        deal_id,
        company: deal.company,
        contact: deal.contact,
        callback_date: date,
        callback_time: time,
        created_at: new Date().toISOString(),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Fidelite tools
// ---------------------------------------------------------------------------

const check_warranty_expiry = {
  riskLevel: "auto",
  description: "Check warranties expiring within N days (default 30)",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const days = params.days || 30;
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const rows = db
      .prepare(
        `SELECT *, CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as days_remaining
       FROM warranties
       WHERE expiry_date <= ? AND expiry_date >= ? AND status IN ('active', 'expiring')
       ORDER BY expiry_date ASC`,
      )
      .all(cutoff, today);
    return { success: true, threshold_days: days, count: rows.length, expiring_warranties: rows };
  },
};

const draft_postsale_followup = {
  riskLevel: "auto+",
  description: "Draft a post-sale follow-up message for a client",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client } = params;
    if (!client) return { success: false, error: "Missing client name" };
    const draft = `Dear ${client},\n\nThank you for your recent purchase. We hope everything is meeting your expectations.\n\nIf you have any questions about your products or need any assistance, please don't hesitate to reach out. We're here to help.\n\nWould you be open to sharing your experience with a quick review? It helps us continue improving our service.\n\nBest regards`;
    return { success: true, client, draft_message: draft };
  },
};

const generate_upsell_recommendation = {
  riskLevel: "auto",
  description: "Generate upsell recommendations based on purchase history",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { client } = params;
    if (!client) return { success: false, error: "Missing client name" };
    const purchases = db
      .prepare(
        `SELECT items, total, created_at FROM quotes
       WHERE lead_name = ? AND status = 'accepted'
       ORDER BY created_at DESC LIMIT 10`,
      )
      .all(client);
    const warranties = db
      .prepare(
        `SELECT product_sku, expiry_date, status FROM warranties
       WHERE client = ? ORDER BY expiry_date ASC`,
      )
      .all(client);
    return {
      success: true,
      client,
      purchase_count: purchases.length,
      recent_purchases: purchases,
      active_warranties: warranties,
      recommendations:
        purchases.length > 0
          ? [
              "Consider complementary products based on purchase history",
              "Offer warranty extension for expiring items",
              "Volume discount for repeat categories",
            ]
          : ["No purchase history found — consider introductory offer"],
    };
  },
};

const send_satisfaction_survey = {
  riskLevel: "propose",
  description: "Draft a satisfaction survey for a client",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client } = params;
    if (!client) return { success: false, error: "Missing client name" };
    return {
      success: true,
      survey_draft: {
        recipient: client,
        subject: "How was your experience?",
        questions: [
          { q: "How would you rate the overall quality of the products?", type: "rating_1_5" },
          { q: "How satisfied are you with the delivery process?", type: "rating_1_5" },
          { q: "How likely are you to recommend us to a colleague?", type: "nps_0_10" },
          { q: "Any additional comments or suggestions?", type: "open_text" },
        ],
        status: "draft",
        requires_approval: true,
      },
    };
  },
};

const calculate_client_lifetime_value = {
  riskLevel: "auto",
  description: "Calculate lifetime value for a client from quote history",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { client } = params;
    if (!client) return { success: false, error: "Missing client name" };
    const stats = db
      .prepare(
        `SELECT
         COUNT(*) as total_quotes,
         SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_quotes,
         COALESCE(SUM(CASE WHEN status = 'accepted' THEN total ELSE 0 END), 0) as total_revenue,
         MIN(created_at) as first_quote,
         MAX(created_at) as last_quote
       FROM quotes WHERE lead_name = ?`,
      )
      .get(client);
    const monthsActive =
      stats.first_quote && stats.last_quote
        ? Math.max(
            1,
            Math.round(
              (new Date(stats.last_quote) - new Date(stats.first_quote)) / (30 * 86400000),
            ),
          )
        : 0;
    const monthlyAvg = monthsActive > 0 ? (stats.total_revenue / monthsActive).toFixed(2) : "0.00";
    return {
      success: true,
      client,
      lifetime_value: stats.total_revenue,
      monthly_average: parseFloat(monthlyAvg),
      months_active: monthsActive,
      conversion_rate:
        stats.total_quotes > 0
          ? ((stats.accepted_quotes / stats.total_quotes) * 100).toFixed(1) + "%"
          : "N/A",
      ...stats,
    };
  },
};

const flag_churn_risk = {
  riskLevel: "auto",
  description: "Flag clients at risk of churning based on declining engagement",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const days = params.days || 60;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const atRisk = db
      .prepare(
        `SELECT company, contact, email, stage, estimated_value, last_contact,
         CAST(julianday('now') - julianday(COALESCE(last_contact, created_at)) AS INTEGER) as days_inactive
       FROM pipeline
       WHERE stage NOT IN ('won', 'lost')
         AND COALESCE(last_contact, created_at) < ?
       ORDER BY days_inactive DESC`,
      )
      .all(cutoff);
    return { success: true, threshold_days: days, count: atRisk.length, at_risk_clients: atRisk };
  },
};

const draft_warranty_renewal = {
  riskLevel: "propose",
  description: "Draft a warranty renewal offer for an expiring warranty",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { warranty_id } = params;
    if (!warranty_id) return { success: false, error: "Missing warranty_id" };
    const warranty = db.prepare("SELECT * FROM warranties WHERE id = ?").get(warranty_id);
    if (!warranty) return { success: false, error: "Warranty not found" };
    const draft = `Dear ${warranty.client},\n\nYour warranty for product ${warranty.product_sku} (purchased ${warranty.purchase_date}) is set to expire on ${warranty.expiry_date}.\n\nWe'd like to offer you a renewal to keep your coverage active. Renewing now ensures uninterrupted protection and priority support.\n\nWould you like to proceed with the renewal?\n\nBest regards`;
    return { success: true, warranty, draft_message: draft, renewal_suggested: true };
  },
};

const log_client_feedback = {
  riskLevel: "auto+",
  description: "Log client feedback for tracking",
  isWriteTool: false,
  execute: async (params, context) => {
    const { client, type, content } = params;
    if (!client || !type || !content) {
      return { success: false, error: "Missing required fields: client, type, content" };
    }
    return {
      success: true,
      feedback: {
        client,
        type,
        content,
        logged_at: new Date().toISOString(),
        status: "recorded",
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Export all tools
// ---------------------------------------------------------------------------

module.exports = {
  // Catalogueur
  sync_inventory,
  update_product_price,
  create_reorder_alert,
  calculate_margins,
  monitor_supplier_feed,
  apply_bulk_price_rule,
  flag_dead_stock,
  generate_catalog_export,
  // Prospecteur
  qualify_lead,
  generate_quote,
  track_pipeline_stage,
  monitor_competitor_prices,
  draft_followup,
  check_credit_risk,
  log_lost_deal,
  generate_sales_report,
  schedule_callback,
  // Fidelite
  check_warranty_expiry,
  draft_postsale_followup,
  generate_upsell_recommendation,
  send_satisfaction_survey,
  calculate_client_lifetime_value,
  flag_churn_risk,
  draft_warranty_renewal,
  log_client_feedback,
};
