CREATE TABLE IF NOT EXISTS peer_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  code VARCHAR(16) NOT NULL UNIQUE,
  code_normalized VARCHAR(16) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_codes_expires_at ON peer_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_peer_codes_used ON peer_codes(is_used, used_at);