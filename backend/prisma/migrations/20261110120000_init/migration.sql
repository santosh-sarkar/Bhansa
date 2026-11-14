-- Base schema from docs/restaurant_saas_schema.sql.
-- Seed data (roles, permissions, plans) is created by prisma/seed.ts.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ENUMS

CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'grace', 'suspended', 'cancelled');
CREATE TYPE org_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE order_type AS ENUM ('dine_in', 'takeaway', 'delivery');
CREATE TYPE order_status AS ENUM ('pending_confirmation', 'placed', 'preparing', 'ready', 'served', 'completed', 'cancelled');
CREATE TYPE order_item_status AS ENUM ('placed', 'preparing', 'ready', 'served', 'cancelled');
CREATE TYPE session_status AS ENUM ('open', 'bill_requested', 'closed');
CREATE TYPE table_status AS ENUM ('free', 'occupied', 'needs_bill');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'online');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE stock_move_type AS ENUM ('restock', 'order_deduction', 'order_restore', 'adjustment', 'wastage');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- PLANS, ORGANIZATIONS, SUBSCRIPTIONS

CREATE TABLE plans (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                  TEXT UNIQUE NOT NULL,
    name                  TEXT NOT NULL,
    price_monthly         NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency              CHAR(3) NOT NULL DEFAULT 'NPR',
    max_outlets           INT NOT NULL DEFAULT 1,
    max_staff             INT,
    max_menu_items        INT,
    multi_outlet_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    features              JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    status      org_status NOT NULL DEFAULT 'active',
    currency    CHAR(3) NOT NULL DEFAULT 'NPR',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id               UUID NOT NULL REFERENCES plans(id),
    status                subscription_status NOT NULL DEFAULT 'trialing',
    trial_ends_at         TIMESTAMPTZ,
    grace_ends_at         TIMESTAMPTZ,
    current_period_end    TIMESTAMPTZ,
    max_outlets_override  INT,
    max_staff_override    INT,
    max_menu_items_override INT,
    external_customer_id  TEXT,
    external_sub_id       TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_subscriptions_live_per_org
    ON subscriptions (organization_id) WHERE status IN ('trialing', 'active', 'grace');

CREATE TABLE custom_plan_leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    contact_name    TEXT NOT NULL,
    contact_email   CITEXT NOT NULL,
    outlet_count    INT,
    message         TEXT,
    handled         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OUTLETS

CREATE TABLE outlets (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                   TEXT NOT NULL DEFAULT 'Main Branch',
    address                TEXT,
    phone                  TEXT,
    timezone               TEXT NOT NULL DEFAULT 'UTC',
    tax_percent            NUMERIC(5,2) NOT NULL DEFAULT 13.00,
    service_charge_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at             TIMESTAMPTZ
);

CREATE INDEX idx_outlets_org ON outlets(organization_id);

-- USERS, ROLES, PERMISSIONS, ASSIGNMENTS

CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
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
    id    SMALLSERIAL PRIMARY KEY,
    code  TEXT UNIQUE NOT NULL,
    name  TEXT NOT NULL
);

CREATE TABLE permissions (
    id          SMALLSERIAL PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE role_permissions (
    role_id       SMALLINT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id SMALLINT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE staff_assignments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlet_id  UUID REFERENCES outlets(id) ON DELETE CASCADE,
    role_id    SMALLINT NOT NULL REFERENCES roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_assign_user_outlet ON staff_assignments(user_id, outlet_id) WHERE outlet_id IS NOT NULL;
CREATE UNIQUE INDEX uq_assign_owner ON staff_assignments(user_id) WHERE outlet_id IS NULL;
CREATE INDEX idx_assign_outlet ON staff_assignments(outlet_id);

CREATE TABLE invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    outlet_id       UUID REFERENCES outlets(id) ON DELETE CASCADE,
    role_id         SMALLINT NOT NULL REFERENCES roles(id),
    email           CITEXT NOT NULL,
    token_hash      TEXT NOT NULL,
    status          invite_status NOT NULL DEFAULT 'pending',
    invited_by      UUID REFERENCES users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_email ON invitations(email);

CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- MENU

CREATE TABLE menu_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_menu_cat_org ON menu_categories(organization_id);

CREATE TABLE menu_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name            TEXT NOT NULL,
    description     TEXT,
    image_url       TEXT,
    base_price      NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
    is_veg          BOOLEAN,
    prep_time_min   INT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_menu_items_org_cat ON menu_items(organization_id, category_id);

CREATE TABLE menu_item_options (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('variant', 'addon')),
    name         TEXT NOT NULL,
    price_delta  NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_options_item ON menu_item_options(menu_item_id);

CREATE TABLE menu_item_outlet_overrides (
    menu_item_id     UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    outlet_id        UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    price_override   NUMERIC(10,2) CHECK (price_override >= 0),
    is_available     BOOLEAN NOT NULL DEFAULT TRUE,
    auto_unavailable BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (menu_item_id, outlet_id)
);

CREATE INDEX idx_override_outlet ON menu_item_outlet_overrides(outlet_id);

-- TABLES, QR, TABLE SESSIONS

CREATE TABLE dining_tables (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    label     TEXT NOT NULL,
    seats     INT,
    qr_token  TEXT UNIQUE NOT NULL,
    status    table_status NOT NULL DEFAULT 'free',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (outlet_id, label)
);

CREATE TABLE table_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id   UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    table_id    UUID NOT NULL REFERENCES dining_tables(id),
    status      session_status NOT NULL DEFAULT 'open',
    guest_token TEXT NOT NULL,
    opened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_open_session_per_table ON table_sessions(table_id) WHERE status <> 'closed';
CREATE INDEX idx_sessions_outlet ON table_sessions(outlet_id, status);

-- ORDERS

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    order_number    INT NOT NULL,
    order_type      order_type NOT NULL DEFAULT 'dine_in',
    status          order_status NOT NULL DEFAULT 'placed',
    session_id      UUID REFERENCES table_sessions(id),
    table_id        UUID REFERENCES dining_tables(id),
    placed_by_user  UUID REFERENCES users(id),
    customer_name   TEXT,
    customer_phone  TEXT,
    notes           TEXT,
    subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL DEFAULT 0,
    confirmed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancel_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (order_type <> 'dine_in' OR session_id IS NOT NULL)
);

CREATE INDEX idx_orders_outlet_status ON orders(outlet_id, status, created_at DESC);
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_orders_outlet_created ON orders(outlet_id, created_at);

CREATE TABLE order_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    outlet_id    UUID NOT NULL REFERENCES outlets(id),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    item_name    TEXT NOT NULL,
    unit_price   NUMERIC(10,2) NOT NULL,
    quantity     INT NOT NULL CHECK (quantity > 0),
    options      JSONB NOT NULL DEFAULT '[]'::jsonb,
    line_total   NUMERIC(10,2) NOT NULL,
    status       order_item_status NOT NULL DEFAULT 'placed',
    notes        TEXT
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_outlet_item ON order_items(outlet_id, menu_item_id);

-- BILLS AND PAYMENTS

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
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id       UUID NOT NULL REFERENCES outlets(id),
    bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    method          payment_method NOT NULL,
    status          payment_status NOT NULL DEFAULT 'pending',
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    provider_ref    TEXT,
    idempotency_key TEXT UNIQUE,
    recorded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_bill ON payments(bill_id);

CREATE TABLE webhook_events (
    id           TEXT PRIMARY KEY,
    provider     TEXT NOT NULL,
    payload      JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INVENTORY

CREATE TABLE ingredients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    unit            TEXT NOT NULL,
    default_cost    NUMERIC(10,4),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (organization_id, name)
);

CREATE TABLE recipe_items (
    menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity      NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (menu_item_id, ingredient_id)
);

CREATE INDEX idx_recipe_ingredient ON recipe_items(ingredient_id);

CREATE TABLE outlet_stock (
    outlet_id     UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity      NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_threshold NUMERIC(14,3) NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (outlet_id, ingredient_id)
);

CREATE TABLE stock_movements (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id      UUID NOT NULL REFERENCES outlets(id),
    ingredient_id  UUID NOT NULL REFERENCES ingredients(id),
    type           stock_move_type NOT NULL,
    quantity_delta NUMERIC(14,3) NOT NULL,
    balance_after  NUMERIC(14,3) NOT NULL,
    unit_cost      NUMERIC(10,4),
    supplier       TEXT,
    reason         TEXT,
    order_id       UUID REFERENCES orders(id),
    performed_by   UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_moves_lookup ON stock_movements(outlet_id, ingredient_id, created_at DESC);
CREATE INDEX idx_stock_moves_order ON stock_movements(order_id);

-- NOTIFICATIONS AND AUDIT

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id  UUID REFERENCES outlets(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID,
    outlet_id       UUID,
    user_id         UUID,
    action          TEXT NOT NULL,
    entity          TEXT,
    entity_id       UUID,
    meta            JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC);
