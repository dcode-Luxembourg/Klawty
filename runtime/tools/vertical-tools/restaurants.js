"use strict";

/**
 * Restaurants Vertical Tools
 *
 * 30 tools across 4 agents: Maitre D', Commis, Critique, Plume
 * Tables: reservations, suppliers, supplier_orders, stock_items, waste_log, reviews, social_posts
 */

const { ensureVerticalSchema } = require("./vertical-db-schema");

let _schemaReady = false;

function initSchema(db) {
  if (_schemaReady) return;
  ensureVerticalSchema(db, "restaurants");
  _schemaReady = true;
}

// ---------------------------------------------------------------------------
// Maitre D' tools
// ---------------------------------------------------------------------------

const list_reservations = {
  riskLevel: "auto",
  description: "List reservations for a given date (default today) with optional status filter",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const date = params.date || new Date().toISOString().slice(0, 10);
    let sql = "SELECT * FROM reservations WHERE date = ?";
    const args = [date];
    if (params.status) {
      sql += " AND status = ?";
      args.push(params.status);
    }
    sql += " ORDER BY time ASC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, date, count: rows.length, reservations: rows };
  },
};

const create_reservation = {
  riskLevel: "auto+",
  description: "Create a new reservation",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { guest_name, date, time, party_size, notes } = params;
    if (!guest_name || !date || !time || !party_size) {
      return {
        success: false,
        error: "Missing required fields: guest_name, date, time, party_size",
      };
    }
    const result = db
      .prepare(
        `INSERT INTO reservations (guest_name, date, time, party_size, notes, status)
       VALUES (?, ?, ?, ?, ?, 'confirmed')`,
      )
      .run(guest_name, date, time, party_size, notes || null);
    return { success: true, reservation_id: result.lastInsertRowid };
  },
};

const update_reservation = {
  riskLevel: "auto+",
  description: "Update an existing reservation",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { reservation_id, updates } = params;
    if (!reservation_id || !updates || typeof updates !== "object") {
      return { success: false, error: "Missing reservation_id or updates object" };
    }
    const allowed = ["guest_name", "date", "time", "party_size", "table_number", "status", "notes"];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return { success: false, error: "No valid fields to update" };
    sets.push("updated_at = datetime('now')");
    values.push(reservation_id);
    const result = db
      .prepare(`UPDATE reservations SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
    return { success: true, changes: result.changes };
  },
};

const cancel_reservation = {
  riskLevel: "auto+",
  description: "Cancel a reservation or mark as no-show",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { reservation_id, reason, no_show } = params;
    if (!reservation_id) return { success: false, error: "Missing reservation_id" };
    const status = no_show ? "no-show" : "cancelled";
    const notes = reason ? `Cancelled: ${reason}` : null;
    const result = db
      .prepare(
        `UPDATE reservations SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`,
      )
      .run(status, notes, reservation_id);
    return { success: true, status, changes: result.changes };
  },
};

const check_availability = {
  riskLevel: "auto",
  description: "Check table availability for a given date, time, and party size",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { date, time, party_size } = params;
    if (!date || !time || !party_size) {
      return { success: false, error: "Missing required fields: date, time, party_size" };
    }
    const capacity = 40;
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(party_size), 0) as booked_covers
       FROM reservations
       WHERE date = ? AND time = ? AND status IN ('confirmed', 'pending', 'seated')`,
      )
      .get(date, time);
    const booked = row.booked_covers;
    const available = capacity - booked;
    const canBook = available >= party_size;
    return {
      success: true,
      date,
      time,
      capacity,
      booked_covers: booked,
      available_covers: available,
      can_book: canBook,
    };
  },
};

const send_no_show_followup = {
  riskLevel: "propose",
  description: "Draft a follow-up message for a no-show reservation",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { reservation_id } = params;
    if (!reservation_id) return { success: false, error: "Missing reservation_id" };
    const reservation = db.prepare("SELECT * FROM reservations WHERE id = ?").get(reservation_id);
    if (!reservation) return { success: false, error: "Reservation not found" };
    const draft = `Dear ${reservation.guest_name},\n\nWe noticed you were unable to join us on ${reservation.date} at ${reservation.time} for your reservation for ${reservation.party_size}.\n\nWe understand plans change — we'd love to welcome you another time. Would you like to rebook?\n\nBest regards`;
    return { success: true, reservation, draft_message: draft };
  },
};

const get_table_stats = {
  riskLevel: "auto",
  description:
    "Get reservation statistics for a date: total covers, confirmed, no-shows, hourly distribution",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const date = params.date || new Date().toISOString().slice(0, 10);
    const totals = db
      .prepare(
        `SELECT
         COUNT(*) as total_reservations,
         COALESCE(SUM(party_size), 0) as total_covers,
         SUM(CASE WHEN status = 'confirmed' THEN party_size ELSE 0 END) as confirmed_covers,
         SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) as no_shows,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancellations
       FROM reservations WHERE date = ?`,
      )
      .get(date);
    const hourly = db
      .prepare(
        `SELECT time, COUNT(*) as count, SUM(party_size) as covers
       FROM reservations WHERE date = ? AND status IN ('confirmed', 'pending', 'seated', 'completed')
       GROUP BY time ORDER BY time`,
      )
      .all(date);
    return { success: true, date, ...totals, hourly_distribution: hourly };
  },
};

const create_waitlist_entry = {
  riskLevel: "auto+",
  description: "Add a guest to the waitlist",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { guest_name, party_size, estimated_wait } = params;
    if (!guest_name || !party_size) {
      return { success: false, error: "Missing required fields: guest_name, party_size" };
    }
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString().slice(11, 16);
    const result = db
      .prepare(
        `INSERT INTO reservations (guest_name, date, time, party_size, status, notes)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        guest_name,
        today,
        now,
        party_size,
        estimated_wait ? `Estimated wait: ${estimated_wait} min` : null,
      );
    return { success: true, waitlist_id: result.lastInsertRowid, estimated_wait };
  },
};

// ---------------------------------------------------------------------------
// Commis tools
// ---------------------------------------------------------------------------

const list_suppliers = {
  riskLevel: "auto",
  description: "List all suppliers",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const rows = db.prepare("SELECT * FROM suppliers ORDER BY name ASC").all();
    return { success: true, count: rows.length, suppliers: rows };
  },
};

const list_orders = {
  riskLevel: "auto",
  description: "List supplier orders with optional status filter",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    let sql = `SELECT so.*, s.name as supplier_name
               FROM supplier_orders so
               LEFT JOIN suppliers s ON so.supplier_id = s.id`;
    const args = [];
    if (params.status) {
      sql += " WHERE so.status = ?";
      args.push(params.status);
    }
    sql += " ORDER BY so.created_at DESC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, orders: rows };
  },
};

const create_order = {
  riskLevel: "propose",
  description: "Create a new supplier order",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { supplier_id, items, delivery_date } = params;
    if (!supplier_id || !items) {
      return { success: false, error: "Missing required fields: supplier_id, items" };
    }
    const itemsStr = typeof items === "string" ? items : JSON.stringify(items);
    const result = db
      .prepare(
        `INSERT INTO supplier_orders (supplier_id, items, delivery_date, status)
       VALUES (?, ?, ?, 'pending')`,
      )
      .run(supplier_id, itemsStr, delivery_date || null);
    return { success: true, order_id: result.lastInsertRowid };
  },
};

const update_order_status = {
  riskLevel: "auto+",
  description: "Update the status of a supplier order",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { order_id, status, notes } = params;
    if (!order_id || !status) return { success: false, error: "Missing order_id or status" };
    const result = db
      .prepare(
        `UPDATE supplier_orders SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`,
      )
      .run(status, notes || null, order_id);
    return { success: true, changes: result.changes };
  },
};

const check_stock_levels = {
  riskLevel: "auto",
  description: "Check stock items below par level",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const rows = db
      .prepare(
        `SELECT *, (par_level - current_level) as deficit
       FROM stock_items
       WHERE current_level < par_level
       ORDER BY (par_level - current_level) DESC`,
      )
      .all();
    return { success: true, count: rows.length, low_stock_items: rows };
  },
};

const compare_supplier_prices = {
  riskLevel: "auto",
  description: "Compare recent prices from different suppliers for a product",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { product } = params;
    if (!product) return { success: false, error: "Missing product name" };
    const rows = db
      .prepare(
        `SELECT so.id, s.name as supplier_name, so.items, so.total_amount, so.created_at
       FROM supplier_orders so
       JOIN suppliers s ON so.supplier_id = s.id
       WHERE so.items LIKE ?
       ORDER BY so.created_at DESC
       LIMIT 20`,
      )
      .all(`%${product}%`);
    return { success: true, product, count: rows.length, price_history: rows };
  },
};

const log_waste = {
  riskLevel: "auto+",
  description: "Log a food waste entry",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { item, quantity, reason } = params;
    if (!item || quantity == null) return { success: false, error: "Missing item or quantity" };
    const result = db
      .prepare("INSERT INTO waste_log (item, quantity, reason) VALUES (?, ?, ?)")
      .run(item, quantity, reason || null);
    return { success: true, waste_id: result.lastInsertRowid };
  },
};

const flag_price_change = {
  riskLevel: "auto+",
  description: "Flag a significant price change from a supplier",
  isWriteTool: false,
  execute: async (params, context) => {
    const { supplier, item, old_price, new_price } = params;
    if (!supplier || !item || old_price == null || new_price == null) {
      return {
        success: false,
        error: "Missing required fields: supplier, item, old_price, new_price",
      };
    }
    const change_pct = (((new_price - old_price) / old_price) * 100).toFixed(1);
    return {
      success: true,
      alert: {
        type: "price_change",
        supplier,
        item,
        old_price,
        new_price,
        change_pct: parseFloat(change_pct),
        direction: new_price > old_price ? "increase" : "decrease",
        flagged_at: new Date().toISOString(),
      },
    };
  },
};

const get_cost_report = {
  riskLevel: "auto",
  description: "Generate a weekly cost report from waste and supplier orders",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const waste = db
      .prepare(
        `SELECT item, SUM(quantity) as total_quantity, COUNT(*) as incidents
       FROM waste_log WHERE logged_at >= ? GROUP BY item ORDER BY total_quantity DESC`,
      )
      .all(weekAgo);
    const orders = db
      .prepare(
        `SELECT s.name as supplier_name, COUNT(*) as order_count, SUM(so.total_amount) as total_spent
       FROM supplier_orders so
       JOIN suppliers s ON so.supplier_id = s.id
       WHERE so.created_at >= ?
       GROUP BY s.name ORDER BY total_spent DESC`,
      )
      .all(weekAgo);
    return { success: true, period_start: weekAgo, waste_summary: waste, order_summary: orders };
  },
};

// ---------------------------------------------------------------------------
// Critique tools
// ---------------------------------------------------------------------------

const fetch_reviews = {
  riskLevel: "auto",
  description: "Fetch reviews with optional platform and date filters",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    let sql = "SELECT * FROM reviews WHERE 1=1";
    const args = [];
    if (params.platform) {
      sql += " AND platform = ?";
      args.push(params.platform);
    }
    if (params.since) {
      sql += " AND fetched_at >= ?";
      args.push(params.since);
    }
    sql += " ORDER BY fetched_at DESC";
    const rows = db.prepare(sql).all(...args);
    return { success: true, count: rows.length, reviews: rows };
  },
};

const classify_review = {
  riskLevel: "auto",
  description: "Classify a review by sentiment",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { review_id } = params;
    if (!review_id) return { success: false, error: "Missing review_id" };
    const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(review_id);
    if (!review) return { success: false, error: "Review not found" };
    let sentiment = "neutral";
    if (review.rating >= 4) sentiment = "positive";
    else if (review.rating <= 2) sentiment = "negative";
    return {
      success: true,
      review_id,
      rating: review.rating,
      sentiment,
      platform: review.platform,
      content_preview: review.content ? review.content.slice(0, 200) : null,
      needs_response: sentiment === "negative" || review.flagged_urgent === 1,
    };
  },
};

const draft_review_response = {
  riskLevel: "propose",
  description: "Draft a response to a review",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { review_id } = params;
    if (!review_id) return { success: false, error: "Missing review_id" };
    const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(review_id);
    if (!review) return { success: false, error: "Review not found" };
    const isPositive = review.rating >= 4;
    const draft = isPositive
      ? `Thank you so much for your wonderful ${review.rating}-star review, ${review.author || "dear guest"}! We're delighted you enjoyed your experience with us. We look forward to welcoming you again soon.`
      : `Dear ${review.author || "guest"}, thank you for taking the time to share your feedback. We're sorry your experience didn't meet expectations. We'd love the opportunity to make things right — please reach out to us directly so we can address your concerns.`;
    return {
      success: true,
      review,
      draft_response: draft,
      tone: isPositive ? "grateful" : "empathetic",
    };
  },
};

const get_sentiment_trends = {
  riskLevel: "auto",
  description: "Aggregate review sentiment trends over time",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const period = params.period || "30";
    const since = new Date(Date.now() - parseInt(period) * 86400000).toISOString().slice(0, 10);
    const trends = db
      .prepare(
        `SELECT
         date(fetched_at) as date,
         COUNT(*) as review_count,
         ROUND(AVG(rating), 2) as avg_rating,
         SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
         SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as neutral
       FROM reviews WHERE fetched_at >= ?
       GROUP BY date(fetched_at) ORDER BY date ASC`,
      )
      .all(since);
    const overall = db
      .prepare(
        `SELECT COUNT(*) as total, ROUND(AVG(rating), 2) as avg_rating
       FROM reviews WHERE fetched_at >= ?`,
      )
      .get(since);
    return { success: true, period_days: parseInt(period), since, overall, daily_trends: trends };
  },
};

const flag_urgent_review = {
  riskLevel: "auto+",
  description: "Flag a review as urgent for immediate attention",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { review_id, reason } = params;
    if (!review_id) return { success: false, error: "Missing review_id" };
    const result = db.prepare("UPDATE reviews SET flagged_urgent = 1 WHERE id = ?").run(review_id);
    return {
      success: true,
      changes: result.changes,
      reason: reason || "Flagged for urgent attention",
    };
  },
};

const track_review_response_rate = {
  riskLevel: "auto",
  description: "Track the response rate across all reviews",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const stats = db
      .prepare(
        `SELECT
         COUNT(*) as total_reviews,
         SUM(CASE WHEN response_status = 'sent' THEN 1 ELSE 0 END) as responded,
         SUM(CASE WHEN response_status = 'pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN response_status = 'drafted' THEN 1 ELSE 0 END) as drafted,
         SUM(CASE WHEN response_status = 'skipped' THEN 1 ELSE 0 END) as skipped
       FROM reviews`,
      )
      .get();
    const rate =
      stats.total_reviews > 0 ? ((stats.responded / stats.total_reviews) * 100).toFixed(1) : "0.0";
    return { success: true, ...stats, response_rate_pct: parseFloat(rate) };
  },
};

const create_reputation_report = {
  riskLevel: "auto",
  description: "Create a comprehensive reputation report from all review data",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const byPlatform = db
      .prepare(
        `SELECT platform, COUNT(*) as count, ROUND(AVG(rating), 2) as avg_rating,
         SUM(CASE WHEN response_status = 'sent' THEN 1 ELSE 0 END) as responded
       FROM reviews GROUP BY platform`,
      )
      .all();
    const urgent = db
      .prepare(
        "SELECT COUNT(*) as count FROM reviews WHERE flagged_urgent = 1 AND response_status = 'pending'",
      )
      .get();
    const overall = db
      .prepare("SELECT COUNT(*) as total, ROUND(AVG(rating), 2) as avg_rating FROM reviews")
      .get();
    return {
      success: true,
      overall,
      by_platform: byPlatform,
      urgent_pending: urgent.count,
      generated_at: new Date().toISOString(),
    };
  },
};

// ---------------------------------------------------------------------------
// Plume tools
// ---------------------------------------------------------------------------

const create_social_post = {
  riskLevel: "propose",
  description: "Create a new social media post draft",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { platform, content, image_url } = params;
    if (!platform || !content) return { success: false, error: "Missing platform or content" };
    const result = db
      .prepare(
        `INSERT INTO social_posts (platform, content, image_url, status)
       VALUES (?, ?, ?, 'draft')`,
      )
      .run(platform, content, image_url || null);
    return { success: true, post_id: result.lastInsertRowid };
  },
};

const schedule_post = {
  riskLevel: "propose",
  description: "Schedule a social media post for publication",
  isWriteTool: true,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const { post_id, scheduled_at } = params;
    if (!post_id || !scheduled_at)
      return { success: false, error: "Missing post_id or scheduled_at" };
    const result = db
      .prepare(`UPDATE social_posts SET status = 'scheduled', scheduled_at = ? WHERE id = ?`)
      .run(scheduled_at, post_id);
    return { success: true, changes: result.changes, scheduled_at };
  },
};

const list_scheduled_posts = {
  riskLevel: "auto",
  description: "List all scheduled social media posts",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    const rows = db
      .prepare(`SELECT * FROM social_posts WHERE status = 'scheduled' ORDER BY scheduled_at ASC`)
      .all();
    return { success: true, count: rows.length, posts: rows };
  },
};

const get_social_metrics = {
  riskLevel: "auto",
  description: "Get social media engagement metrics",
  isWriteTool: false,
  execute: async (params, context) => {
    const db = context.getDatabase();
    initSchema(db);
    let sql = `SELECT platform,
         COUNT(*) as post_count,
         SUM(engagement_likes) as total_likes,
         SUM(engagement_shares) as total_shares,
         SUM(engagement_comments) as total_comments
       FROM social_posts WHERE status = 'published'`;
    const args = [];
    if (params.platform) {
      sql += " AND platform = ?";
      args.push(params.platform);
    }
    if (params.period) {
      const since = new Date(Date.now() - parseInt(params.period) * 86400000).toISOString();
      sql += " AND published_at >= ?";
      args.push(since);
    }
    sql += " GROUP BY platform";
    const rows = db.prepare(sql).all(...args);
    return { success: true, metrics: rows };
  },
};

const create_campaign = {
  riskLevel: "propose",
  description: "Create a social media campaign plan",
  isWriteTool: false,
  execute: async (params, context) => {
    const { name, type, start_date, end_date } = params;
    if (!name || !type || !start_date || !end_date) {
      return { success: false, error: "Missing required fields: name, type, start_date, end_date" };
    }
    return {
      success: true,
      campaign: {
        name,
        type,
        start_date,
        end_date,
        status: "planned",
        suggested_posts: [
          { day: 1, platform: "instagram", type: "photo", topic: `${name} launch` },
          { day: 3, platform: "facebook", type: "story", topic: `${name} behind the scenes` },
          { day: 5, platform: "instagram", type: "reel", topic: `${name} highlight` },
          { day: 7, platform: "facebook", type: "post", topic: `${name} recap` },
        ],
        created_at: new Date().toISOString(),
      },
    };
  },
};

const draft_menu_announcement = {
  riskLevel: "propose",
  description: "Draft a menu change announcement for social media",
  isWriteTool: false,
  execute: async (params, context) => {
    const { change_type, details } = params;
    if (!change_type || !details) {
      return { success: false, error: "Missing change_type or details" };
    }
    const templates = {
      new_dish: `Exciting news! We've added something special to our menu: ${details}. Come taste the difference!`,
      seasonal: `Season's flavours have arrived! ${details}. Available for a limited time — book your table now.`,
      removal: `Saying goodbye to a favourite: ${details}. But don't worry — something new is on the way.`,
      special: `This week's special: ${details}. Available while supplies last!`,
    };
    const draft = templates[change_type] || `Menu update: ${details}. Visit us to try it!`;
    return { success: true, change_type, draft_announcement: draft };
  },
};

const get_local_seo_status = {
  riskLevel: "auto",
  description: "Get a checklist of local SEO signals",
  isWriteTool: false,
  execute: async (params, context) => {
    return {
      success: true,
      checklist: [
        { signal: "Google Business Profile", status: "check_required", priority: "high" },
        { signal: "NAP consistency", status: "check_required", priority: "high" },
        { signal: "Review volume (last 30 days)", status: "check_required", priority: "high" },
        { signal: "Review response rate", status: "check_required", priority: "medium" },
        { signal: "Menu schema markup", status: "check_required", priority: "medium" },
        { signal: "Local backlinks", status: "check_required", priority: "medium" },
        { signal: "Photo recency", status: "check_required", priority: "low" },
        { signal: "Posts frequency", status: "check_required", priority: "low" },
      ],
      note: "Statuses require external API verification — this is a template checklist",
    };
  },
};

const create_email_blast = {
  riskLevel: "confirm",
  description: "Draft an email blast for a target audience",
  isWriteTool: false,
  execute: async (params, context) => {
    const { subject, content, audience } = params;
    if (!subject || !content || !audience) {
      return { success: false, error: "Missing required fields: subject, content, audience" };
    }
    return {
      success: true,
      draft: {
        subject,
        content,
        audience,
        status: "draft",
        requires_approval: true,
        note: "Email blast requires explicit human approval before sending",
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Export all tools
// ---------------------------------------------------------------------------

module.exports = {
  // Maitre D'
  list_reservations,
  create_reservation,
  update_reservation,
  cancel_reservation,
  check_availability,
  send_no_show_followup,
  get_table_stats,
  create_waitlist_entry,
  // Commis
  list_suppliers,
  list_orders,
  create_order,
  update_order_status,
  check_stock_levels,
  compare_supplier_prices,
  log_waste,
  flag_price_change,
  get_cost_report,
  // Critique
  fetch_reviews,
  classify_review,
  draft_review_response,
  get_sentiment_trends,
  flag_urgent_review,
  track_review_response_rate,
  create_reputation_report,
  // Plume
  create_social_post,
  schedule_post,
  list_scheduled_posts,
  get_social_metrics,
  create_campaign,
  draft_menu_announcement,
  get_local_seo_status,
  create_email_blast,
};
