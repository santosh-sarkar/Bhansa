-- Additions from docs/DATABASE.md section 4 plus approved decisions D-043 to D-046.

-- Last active outlet for Owner and Manager
ALTER TABLE users ADD COLUMN last_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL;

-- Refresh-token rotation and reuse detection
ALTER TABLE refresh_tokens
    ADD COLUMN family_id UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN used_at TIMESTAMPTZ,
    ADD COLUMN replaced_by UUID REFERENCES refresh_tokens(id);

CREATE INDEX idx_refresh_family ON refresh_tokens(family_id);

-- Email verification
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

CREATE TABLE auth_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id, purpose);

-- Guest order confirmation and order numbering
ALTER TABLE orders
    ADD COLUMN confirmed_by UUID REFERENCES users(id),
    ADD COLUMN rejected_by UUID REFERENCES users(id),
    ADD COLUMN idempotency_key TEXT,
    ADD COLUMN business_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE UNIQUE INDEX uq_orders_idem ON orders(outlet_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX uq_orders_number_per_day ON orders(outlet_id, business_date, order_number);

-- eSewa credentials per outlet, encrypted
CREATE TABLE outlet_payment_settings (
    outlet_id            UUID PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
    provider             TEXT NOT NULL DEFAULT 'esewa',
    product_code         TEXT NOT NULL,
    secret_key_encrypted TEXT NOT NULL,
    is_test_mode         BOOLEAN NOT NULL DEFAULT TRUE,
    is_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- eSewa transaction tracking
ALTER TABLE payments
    ADD COLUMN transaction_uuid TEXT UNIQUE,
    ADD COLUMN raw_callback JSONB,
    ADD COLUMN verified_at TIMESTAMPTZ;

-- Manual SaaS subscription payments
CREATE TABLE subscription_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    reference       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
    period_months   INT NOT NULL DEFAULT 1,
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bill cancellation keeps the invoice number (D-046)
CREATE TYPE bill_status AS ENUM ('open', 'paid', 'cancelled');

ALTER TABLE bills
    ADD COLUMN status bill_status NOT NULL DEFAULT 'open',
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancelled_by UUID REFERENCES users(id),
    ADD COLUMN cancel_reason TEXT;
