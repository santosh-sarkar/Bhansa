-- =====================================================================
-- Restaurant SaaS - PostgreSQL schema (v1, multi-outlet ready)
-- Hierarchy: Organization -> Outlet -> operational data
-- Every operational table carries outlet_id.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive emails

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE subscription_status AS ENUM ('trialing','active','grace','suspended','cancelled');
CREATE TYPE org_status          AS ENUM ('pending','active','suspended');
CREATE TYPE order_type          AS ENUM ('dine_in','takeaway','delivery');   -- delivery used in v2
CREATE TYPE order_status        AS ENUM ('pending_confirmation','placed','preparing','ready','served','completed','cancelled');
CREATE TYPE order_item_status   AS ENUM ('placed','preparing','ready','served','cancelled');
CREATE TYPE session_status      AS ENUM ('open','bill_requested','closed');
CREATE TYPE table_status        AS ENUM ('free','occupied','needs_bill');
CREATE TYPE payment_method      AS ENUM ('cash','card','online');
CREATE TYPE payment_status      AS ENUM ('pending','succeeded','failed','refunded');
CREATE TYPE stock_move_type     AS ENUM ('restock','order_deduction','order_restore','adjustment','wastage');
CREATE TYPE invite_status       AS ENUM ('pending','accepted','expired','revoked');

-- ---------------------------------------------------------------------
-- 1. PLANS, ORGANIZATIONS, SUBSCRIPTIONS
-- ---------------------------------------------------------------------
CREATE TABLE plans (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  TEXT UNIQUE NOT NULL,            -- 'trial','single','custom'
    name                  TEXT NOT NULL,
    price_monthly         NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency              CHAR(3) NOT NULL DEFAULT 'USD',
    max_outlets           INT NOT NULL DEFAULT 1,
    max_staff             INT,                              -- NULL = unlimited
    max_menu_items        INT,
    multi_outlet_enabled  BOOLEAN NOT NULL DEFAULT FALSE,   -- controls switcher in v2
    features              JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"inventory":true,"analytics":true}
    is_public             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    status      org_status NOT NULL DEFAULT 'active',
    currency    CHAR(3) NOT NULL DEFAULT 'USD',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id               UUID NOT NULL REFERENCES plans(id),
    status                subscription_status NOT NULL DEFAULT 'trialing',
    trial_ends_at         TIMESTAMPTZ,
    grace_ends_at         TIMESTAMPTZ,                     -- trial end + 7 days read-only
    current_period_end    TIMESTAMPTZ,
    -- per-organization overrides so "custom" is just data, not code
    max_outlets_override  INT,
    max_staff_override    INT,
    max_menu_items_override INT,
    external_customer_id  TEXT,                            -- Stripe/Razorpay customer
    external_sub_id       TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one live subscription per organization
CREATE UNIQUE INDEX uq_subscriptions_live_per_org
    ON subscriptions (organization_id) WHERE status IN ('trialing','active','grace');

CREATE TABLE custom_plan_leads (            -- "Contact us" for Custom plan
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    contact_name    TEXT NOT NULL,
    contact_email   CITEXT NOT NULL,
    outlet_count    INT,
    message         TEXT,
    handled         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. OUTLETS
-- ---------------------------------------------------------------------
CREATE TABLE outlets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL DEFAULT 'Main Branch',
    address          TEXT,
    phone            TEXT,
    timezone         TEXT NOT NULL DEFAULT 'UTC',
    tax_percent      NUMERIC(5,2) NOT NULL DEFAULT 0,
    service_charge_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX idx_outlets_org ON outlets(organization_id);

-- ---------------------------------------------------------------------
-- 3. USERS, ROLES, PERMISSIONS, ASSIGNMENTS
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for super admin
    email            CITEXT UNIQUE NOT NULL,
    password_hash    TEXT NOT NULL,
    full_name        TEXT NOT NULL,
    phone            TEXT,
    is_super_admin   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_org ON users(organization_id);

CREATE TABLE roles (
    id          SMALLSERIAL PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,     -- 'owner','manager','waiter','kitchen'
    name        TEXT NOT NULL
);

CREATE TABLE permissions (
    id          SMALLSERIAL PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,     -- 'menu.edit','order.update_status',...
    description TEXT
);

CREATE TABLE role_permissions (
    role_id        SMALLINT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id  SMALLINT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- user + outlet + role. Owner has outlet_id NULL = all outlets in the org.
CREATE TABLE staff_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlet_id   UUID REFERENCES outlets(id) ON DELETE CASCADE,
    role_id     SMALLINT NOT NULL REFERENCES roles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_assign_user_outlet ON staff_assignments(user_id, outlet_id) WHERE outlet_id IS NOT NULL;
CREATE UNIQUE INDEX uq_assign_owner       ON staff_assignments(user_id) WHERE outlet_id IS NULL;
CREATE INDEX idx_assign_outlet ON staff_assignments(outlet_id);

CREATE TABLE invitations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id        UUID REFERENCES outlets(id) ON DELETE CASCADE,
    role_id          SMALLINT NOT NULL REFERENCES roles(id),
    email            CITEXT NOT NULL,
    token_hash       TEXT NOT NULL,
    status           invite_status NOT NULL DEFAULT 'pending',
    invited_by       UUID REFERENCES users(id),
    expires_at       TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invites_email ON invitations(email);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- ---------------------------------------------------------------------
-- 4. MENU (org-level master + per-outlet overrides)
-- ---------------------------------------------------------------------
CREATE TABLE menu_categories (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    sort_order       INT NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_menu_cat_org ON menu_categories(organization_id);

CREATE TABLE menu_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id      UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name             TEXT NOT NULL,
    description      TEXT,
    image_url        TEXT,
    base_price       NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
    is_veg           BOOLEAN,
    prep_time_min    INT,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,   -- master switch
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX idx_menu_items_org_cat ON menu_items(organization_id, category_id);

-- variants (size) and add-ons (extra cheese) in one flexible table
CREATE TABLE menu_item_options (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id   UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    kind           TEXT NOT NULL CHECK (kind IN ('variant','addon')),
    name           TEXT NOT NULL,
    price_delta    NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_options_item ON menu_item_options(menu_item_id);

-- empty in v1, but present from day one
CREATE TABLE menu_item_outlet_overrides (
    menu_item_id     UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    outlet_id        UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    price_override   NUMERIC(10,2) CHECK (price_override >= 0),
    is_available     BOOLEAN NOT NULL DEFAULT TRUE,        -- manual toggle
    auto_unavailable BOOLEAN NOT NULL DEFAULT FALSE,       -- set by inventory when ingredient is out
    PRIMARY KEY (menu_item_id, outlet_id)
);
CREATE INDEX idx_override_outlet ON menu_item_outlet_overrides(outlet_id);

-- ---------------------------------------------------------------------
-- 5. TABLES, QR, TABLE SESSIONS
-- ---------------------------------------------------------------------
CREATE TABLE dining_tables (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id   UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,                       -- 'T1', 'Patio 3'
    seats       INT,
    qr_token    TEXT UNIQUE NOT NULL,                -- random, unguessable; encoded in QR URL
    status      table_status NOT NULL DEFAULT 'free',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (outlet_id, label)
);

CREATE TABLE table_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    table_id        UUID NOT NULL REFERENCES dining_tables(id),
    status          session_status NOT NULL DEFAULT 'open',
    guest_token     TEXT NOT NULL,                   -- identifies the customer device/session
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ
);
-- only one open session per table at a time
CREATE UNIQUE INDEX uq_open_session_per_table
    ON table_sessions(table_id) WHERE status <> 'closed';
CREATE INDEX idx_sessions_outlet ON table_sessions(outlet_id, status);

-- ---------------------------------------------------------------------
-- 6. ORDERS
-- ---------------------------------------------------------------------
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id        UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    order_number     INT NOT NULL,                   -- human-friendly, per outlet per day
    order_type       order_type NOT NULL DEFAULT 'dine_in',
    status           order_status NOT NULL DEFAULT 'placed',
    session_id       UUID REFERENCES table_sessions(id),
    table_id         UUID REFERENCES dining_tables(id),
    placed_by_user   UUID REFERENCES users(id),      -- waiter, NULL if guest
    customer_name    TEXT,
    customer_phone   TEXT,
    notes            TEXT,
    subtotal         NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
    total            NUMERIC(10,2) NOT NULL DEFAULT 0,
    confirmed_at     TIMESTAMPTZ,                    -- stock deducted here
    cancelled_at     TIMESTAMPTZ,
    cancel_reason    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (order_type <> 'dine_in' OR session_id IS NOT NULL)
);
CREATE INDEX idx_orders_outlet_status ON orders(outlet_id, status, created_at DESC);
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_orders_outlet_created ON orders(outlet_id, created_at);   -- analytics

CREATE TABLE order_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    outlet_id      UUID NOT NULL REFERENCES outlets(id),     -- denormalized for fast outlet-scoped queries
    menu_item_id   UUID NOT NULL REFERENCES menu_items(id),
    item_name      TEXT NOT NULL,                            -- snapshot
    unit_price     NUMERIC(10,2) NOT NULL,                   -- snapshot
    quantity       INT NOT NULL CHECK (quantity > 0),
    options        JSONB NOT NULL DEFAULT '[]'::jsonb,       -- snapshot of chosen variants/add-ons
    line_total     NUMERIC(10,2) NOT NULL,
    status         order_item_status NOT NULL DEFAULT 'placed',
    notes          TEXT
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_outlet_item ON order_items(outlet_id, menu_item_id);  -- top-sellers

-- ---------------------------------------------------------------------
-- 7. BILLS & PAYMENTS
-- ---------------------------------------------------------------------
CREATE TABLE bills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id       UUID NOT NULL REFERENCES outlets(id),
    session_id      UUID REFERENCES table_sessions(id),
    invoice_number  TEXT NOT NULL,
    subtotal        NUMERIC(10,2) NOT NULL,
    tax_amount      NUMERIC(10,2) NOT NULL,
    service_charge  NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL,
    paid_at         TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (outlet_id, invoice_number)
);

CREATE TABLE payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id         UUID NOT NULL REFERENCES outlets(id),
    bill_id           UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    method            payment_method NOT NULL,
    status            payment_status NOT NULL DEFAULT 'pending',
    amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    provider_ref      TEXT,                          -- gateway payment/intent id
    idempotency_key   TEXT UNIQUE,                   -- prevents double charges
    recorded_by       UUID REFERENCES users(id),     -- for cash
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_bill ON payments(bill_id);

CREATE TABLE webhook_events (                        -- idempotent webhook handling
    id            TEXT PRIMARY KEY,                  -- provider event id
    provider      TEXT NOT NULL,
    payload       JSONB NOT NULL,
    processed_at  TIMESTAMPTZ,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. INVENTORY
-- ---------------------------------------------------------------------
CREATE TABLE ingredients (                           -- shared definition (org level)
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    unit             TEXT NOT NULL,                  -- 'g','ml','pcs'
    default_cost     NUMERIC(10,4),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (organization_id, name)
);

CREATE TABLE recipe_items (                          -- menu item -> ingredients (shared)
    menu_item_id   UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity       NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (menu_item_id, ingredient_id)
);
CREATE INDEX idx_recipe_ingredient ON recipe_items(ingredient_id);

CREATE TABLE outlet_stock (                          -- quantities live per outlet
    outlet_id         UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    ingredient_id     UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity          NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),  -- DB-level oversell guard
    low_threshold     NUMERIC(14,3) NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (outlet_id, ingredient_id)
);

CREATE TABLE stock_movements (                       -- append-only audit trail
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id      UUID NOT NULL REFERENCES outlets(id),
    ingredient_id  UUID NOT NULL REFERENCES ingredients(id),
    type           stock_move_type NOT NULL,
    quantity_delta NUMERIC(14,3) NOT NULL,           -- + in, - out
    balance_after  NUMERIC(14,3) NOT NULL,
    unit_cost      NUMERIC(10,4),
    supplier       TEXT,
    reason         TEXT,
    order_id       UUID REFERENCES orders(id),       -- for auto movements
    performed_by   UUID REFERENCES users(id),        -- NULL for system
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_moves_lookup ON stock_movements(outlet_id, ingredient_id, created_at DESC);
CREATE INDEX idx_stock_moves_order  ON stock_movements(order_id);

-- ---------------------------------------------------------------------
-- 9. NOTIFICATIONS & AUDIT
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id   UUID REFERENCES outlets(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,   -- NULL = broadcast to outlet role
    type        TEXT NOT NULL,                                 -- 'low_stock','bill_requested',...
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE audit_logs (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  UUID,
    outlet_id        UUID,
    user_id          UUID,
    action           TEXT NOT NULL,                  -- 'menu.price_changed','staff.removed'
    entity           TEXT,
    entity_id        UUID,
    meta             JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 10. SEED DATA: roles, permissions, plans
-- ---------------------------------------------------------------------
INSERT INTO roles (code, name) VALUES
 ('owner','Owner'),('manager','Manager'),('waiter','Waiter'),('kitchen','Kitchen');

INSERT INTO permissions (code, description) VALUES
 ('billing.manage','Manage billing and subscription'),
 ('staff.manage','Invite and manage staff'),
 ('menu.edit','Edit menu, prices, categories'),
 ('tables.manage','Manage tables and QR codes'),
 ('order.create','Place or edit orders'),
 ('order.update_status','Update order status'),
 ('order.cancel','Cancel orders'),
 ('payment.record','Generate bills and record payments'),
 ('analytics.view','View analytics and reports'),
 ('inventory.manage','Manage ingredients, recipes, thresholds'),
 ('inventory.restock','Record restocks'),
 ('inventory.adjust','Adjust stock counts'),
 ('inventory.wastage','Log wastage'),
 ('inventory.view','View inventory and alerts'),
 ('item.mark_unavailable','Mark item or ingredient out of stock');

-- Owner: everything
INSERT INTO role_permissions SELECT r.id, p.id FROM roles r, permissions p WHERE r.code='owner';
-- Manager: everything except billing
INSERT INTO role_permissions SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code='manager' AND p.code <> 'billing.manage';
-- Waiter
INSERT INTO role_permissions SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code='waiter' AND p.code IN ('order.create','order.update_status','payment.record');
-- Kitchen
INSERT INTO role_permissions SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code='kitchen' AND p.code IN ('order.update_status','inventory.adjust','inventory.wastage',
                                       'inventory.view','item.mark_unavailable');

INSERT INTO plans (code, name, price_monthly, max_outlets, max_staff, max_menu_items, multi_outlet_enabled, features) VALUES
 ('trial','Free Trial (14 days)',0,1,NULL,NULL,FALSE,'{"inventory":true,"analytics":true}'),
 ('single','Single Outlet',29,1,NULL,NULL,FALSE,'{"inventory":true,"analytics":true}'),
 ('custom','Custom / Multi-Outlet',0,1,NULL,NULL,TRUE,'{"inventory":true,"analytics":true,"consolidated_dashboard":true}');
