"use strict";

/**
 * Vertical DB Schema Definitions
 *
 * Idempotently creates SQLite tables for each vertical's domain data.
 * Called during engine init when a vertical is configured.
 */

const SCHEMAS = {
  restaurants: `
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      party_size INTEGER NOT NULL DEFAULT 2,
      table_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('confirmed','pending','cancelled','no-show','seated','completed')),
      notes TEXT,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      category TEXT,
      payment_terms TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supplier_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      items TEXT NOT NULL,
      delivery_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','delivered','overdue','cancelled','short')),
      total_amount REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT,
      current_level REAL NOT NULL DEFAULT 0,
      par_level REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'units',
      last_checked TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS waste_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      external_id TEXT,
      author TEXT,
      rating REAL,
      content TEXT,
      sentiment TEXT,
      topics TEXT,
      response TEXT,
      response_status TEXT NOT NULL DEFAULT 'pending' CHECK(response_status IN ('pending','drafted','sent','skipped')),
      flagged_urgent INTEGER NOT NULL DEFAULT 0,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      responded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS social_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','published','failed')),
      scheduled_at TEXT,
      published_at TEXT,
      engagement_likes INTEGER NOT NULL DEFAULT 0,
      engagement_shares INTEGER NOT NULL DEFAULT 0,
      engagement_comments INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `,

  "real-estate": `
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT,
      address TEXT,
      city TEXT,
      price REAL,
      price_per_sqm REAL,
      area_sqm REAL,
      rooms INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','under_offer','sold','rented','withdrawn')),
      mandate_type TEXT,
      mandate_signed TEXT,
      cpe_status TEXT,
      photos_count INTEGER NOT NULL DEFAULT 0,
      portal_synced INTEGER NOT NULL DEFAULT 0,
      days_on_market INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      budget_min REAL,
      budget_max REAL,
      property_type TEXT,
      source TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','qualified','viewing','offer','negotiation','won','lost')),
      assigned_property_id INTEGER REFERENCES properties(id),
      notes TEXT,
      last_contact TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS viewings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id),
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled','no_show')),
      feedback TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id),
      tenant_name TEXT NOT NULL,
      tenant_email TEXT,
      rent_amount REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      deposit_amount REAL,
      indexation_formula TEXT,
      break_clause_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expiring','expired','terminated')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id),
      tenant_name TEXT NOT NULL,
      category TEXT,
      severity TEXT NOT NULL DEFAULT 'normal' CHECK(severity IN ('low','normal','urgent','emergency')),
      description TEXT NOT NULL,
      contractor TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','assigned','in_progress','completed','cancelled')),
      estimated_cost REAL,
      actual_cost REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
  `,

  construction: `
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      start_date TEXT,
      end_date TEXT,
      budget REAL,
      spent REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      phase TEXT,
      planned_date TEXT,
      actual_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','started','completed','delayed','blocked')),
      percent_complete INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      evidence TEXT
    );

    CREATE TABLE IF NOT EXISTS rfqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      material TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','sent','received','awarded','cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supplier_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_id INTEGER NOT NULL REFERENCES rfqs(id),
      supplier TEXT NOT NULL,
      price REAL NOT NULL,
      lead_time_days INTEGER,
      terms TEXT,
      quality_score REAL,
      selected INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      supplier TEXT NOT NULL,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      delivery_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','shipped','delivered','overdue')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL,
      authority TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','submitted','approved','expired','rejected')),
      expiry_date TEXT,
      document_ref TEXT
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL,
      inspector TEXT,
      date TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'pass' CHECK(result IN ('pass','fail','conditional')),
      deficiencies TEXT,
      followup_deadline TEXT
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      cert_type TEXT NOT NULL,
      valid_until TEXT,
      document_ref TEXT,
      status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','expiring','expired','missing'))
    );
  `,

  resellers: `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      supplier TEXT,
      cost_price REAL,
      sell_price REAL,
      stock_level INTEGER NOT NULL DEFAULT 0,
      reorder_point INTEGER NOT NULL DEFAULT 0,
      last_sold TEXT,
      channel_synced INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_name TEXT NOT NULL,
      lead_email TEXT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      margin_pct REAL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sent','accepted','rejected','expired')),
      valid_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pipeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      contact TEXT,
      email TEXT,
      source TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','quoted','negotiation','won','lost')),
      estimated_value REAL,
      notes TEXT,
      last_contact TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS warranties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expiring','expired','renewed')),
      renewal_offered INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS competitor_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_sku TEXT NOT NULL,
      competitor TEXT NOT NULL,
      price REAL NOT NULL,
      url TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `,

  accounting: `
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'invoice' CHECK(type IN ('invoice','credit_note','expense','bank_statement','payslip','other')),
      vendor TEXT,
      vendor_id INTEGER,
      invoice_number TEXT,
      date TEXT,
      amount_htva REAL,
      vat_amount REAL,
      amount_ttc REAL,
      vat_rate REAL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      confidence_score REAL,
      source_file TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','classified','extracted','reviewed','posted','rejected','duplicate')),
      client_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id),
      debit_account TEXT NOT NULL,
      credit_account TEXT NOT NULL,
      amount REAL NOT NULL,
      vat_code TEXT,
      cost_center TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','approved','posted','rejected')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      vat_number TEXT,
      iban TEXT,
      default_debit_account TEXT,
      payment_terms TEXT,
      country TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deadlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      filing_period TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','at_risk','filed','overdue','extended')),
      data_completeness_pct REAL NOT NULL DEFAULT 0,
      reminder_stage INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_onboarding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      item TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','requested','received','verified')),
      requested_at TEXT,
      received_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reconciliation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period TEXT NOT NULL,
      bank_amount REAL NOT NULL,
      ledger_amount REAL NOT NULL,
      variance REAL NOT NULL DEFAULT 0,
      matched_count INTEGER NOT NULL DEFAULT 0,
      unmatched_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','issues_found')),
      completed_at TEXT
    );
  `,

  "law-firms": `
    CREATE TABLE IF NOT EXISTS matters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      client_id TEXT,
      title TEXT NOT NULL,
      type TEXT,
      jurisdiction TEXT,
      responsible_lawyer TEXT,
      stage TEXT NOT NULL DEFAULT 'intake' CHECK(stage IN ('intake','active','hearing','judgment','appeal','closed','archived')),
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS court_deadlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER NOT NULL REFERENCES matters(id),
      type TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      preparation_complete INTEGER NOT NULL DEFAULT 0,
      alert_sent_t7 INTEGER NOT NULL DEFAULT 0,
      alert_sent_t3 INTEGER NOT NULL DEFAULT 0,
      alert_sent_t1 INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','due','completed','missed'))
    );

    CREATE TABLE IF NOT EXISTS limitation_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER NOT NULL REFERENCES matters(id),
      type TEXT NOT NULL,
      triggering_event TEXT,
      event_date TEXT NOT NULL,
      period_years INTEGER NOT NULL,
      expiry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','expiring','expired','suspended','interrupted'))
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER NOT NULL REFERENCES matters(id),
      checked_entity TEXT NOT NULL,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('client','opposing_party','related_entity')),
      conflict_found INTEGER NOT NULL DEFAULT 0,
      details TEXT,
      resolution TEXT,
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS legal_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER NOT NULL REFERENCES matters(id),
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('contract','filing','correspondence','notarial_act','memo','template','other')),
      version INTEGER NOT NULL DEFAULT 1,
      file_path TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','final','signed','archived')),
      clauses_extracted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clause_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES legal_documents(id),
      clause_type TEXT NOT NULL,
      section_number TEXT,
      content TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'normal' CHECK(risk_level IN ('low','normal','elevated','high'))
    );

    CREATE TABLE IF NOT EXISTS research_memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER REFERENCES matters(id),
      topic TEXT NOT NULL,
      jurisdiction TEXT,
      citations TEXT,
      analysis TEXT,
      recommendation TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','reviewed','final')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS billing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id INTEGER NOT NULL REFERENCES matters(id),
      type TEXT NOT NULL CHECK(type IN ('hours','disbursement','fixed_fee')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL DEFAULT (datetime('now')),
      invoiced INTEGER NOT NULL DEFAULT 0
    );
  `,
};

/**
 * Idempotently create vertical-specific tables in the given SQLite database.
 *
 * @param {import('better-sqlite3').Database} db - better-sqlite3 database instance
 * @param {string} verticalId - one of: restaurants, real-estate, construction, resellers, accounting, law-firms
 * @returns {{ created: boolean, tables: number }} result
 */
function ensureVerticalSchema(db, verticalId) {
  const schema = SCHEMAS[verticalId];
  if (!schema) {
    return { created: false, tables: 0 };
  }

  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const transaction = db.transaction(() => {
    for (const stmt of statements) {
      db.exec(stmt + ";");
    }
  });

  transaction();

  return { created: true, tables: statements.length };
}

module.exports = { ensureVerticalSchema, SCHEMAS };
