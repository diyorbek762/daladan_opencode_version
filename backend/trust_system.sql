-- ═══════════════════════════════════════════════════════
--  Daladan Trust & Rating System — Database Migration
--  Run: psql -h localhost -U postgres -d daladan -f backend/trust_system.sql
-- ═══════════════════════════════════════════════════════

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ───────────────────────────────────────────────────────
--  1. user_ratings
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_ratings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deal_group_id UUID NOT NULL REFERENCES deal_groups(id) ON DELETE CASCADE,
    score         INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    on_time       BOOLEAN NOT NULL DEFAULT TRUE,
    as_described  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One rating per reviewer per deal
    CONSTRAINT uq_reviewer_deal UNIQUE (reviewer_id, deal_group_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_reviewee ON user_ratings(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_deal     ON user_ratings(deal_group_id);


-- ───────────────────────────────────────────────────────
--  2. user_documents
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_url      VARCHAR(500) NOT NULL,
    document_type VARCHAR(50)  NOT NULL,  -- e.g. 'license', 'certificate', 'passport'
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_user ON user_documents(user_id);


-- ───────────────────────────────────────────────────────
--  3. user_contacts
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_contacts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_type  VARCHAR(30)  NOT NULL,  -- 'telegram', 'whatsapp', 'phone', 'website'
    contact_value VARCHAR(255) NOT NULL,
    is_public     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One entry per type per user
    CONSTRAINT uq_user_contact_type UNIQUE (user_id, contact_type)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON user_contacts(user_id);


-- ═══════════════════════════════════════════════════════
--  4. Materialized Views — Leaderboards
--
--  Weighted trust score (0–100):
--    base        = AVG(score) / 5 * 40      (max 40 pts from avg rating)
--    on_time_pct = % on_time TRUE   * 30    (max 30 pts)
--    as_desc_pct = % as_described   * 20    (max 20 pts)
--    doc_bonus   = MIN(verified_docs, 5)/5*10  (max 10 pts)
-- ═══════════════════════════════════════════════════════

-- ── Producer Leaderboard ──
CREATE MATERIALIZED VIEW IF NOT EXISTS producer_leaderboard AS
SELECT
    u.id                                           AS user_id,
    u.full_name,
    COUNT(r.id)                                    AS total_ratings,
    ROUND(COALESCE(AVG(r.score), 0)::numeric, 2)  AS avg_score,
    ROUND(
        COALESCE(AVG(r.score), 0) / 5.0 * 40
      + COALESCE(AVG(r.on_time::int), 0) * 30
      + COALESCE(AVG(r.as_described::int), 0) * 20
      + LEAST(COALESCE(d.doc_count, 0), 5) / 5.0 * 10
    , 2)                                           AS trust_score,
    RANK() OVER (ORDER BY
        COALESCE(AVG(r.score), 0) / 5.0 * 40
      + COALESCE(AVG(r.on_time::int), 0) * 30
      + COALESCE(AVG(r.as_described::int), 0) * 20
      + LEAST(COALESCE(d.doc_count, 0), 5) / 5.0 * 10
    DESC)                                          AS rank
FROM users u
LEFT JOIN user_ratings r ON r.reviewee_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS doc_count
    FROM user_documents WHERE is_verified = TRUE
    GROUP BY user_id
) d ON d.user_id = u.id
WHERE u.role = 'producer'
GROUP BY u.id, u.full_name, d.doc_count;

CREATE UNIQUE INDEX IF NOT EXISTS idx_producer_lb_user ON producer_leaderboard(user_id);


-- ── Driver Leaderboard ──
CREATE MATERIALIZED VIEW IF NOT EXISTS driver_leaderboard AS
SELECT
    u.id                                           AS user_id,
    u.full_name,
    COUNT(r.id)                                    AS total_ratings,
    ROUND(COALESCE(AVG(r.score), 0)::numeric, 2)  AS avg_score,
    ROUND(
        COALESCE(AVG(r.score), 0) / 5.0 * 40
      + COALESCE(AVG(r.on_time::int), 0) * 30
      + COALESCE(AVG(r.as_described::int), 0) * 20
      + LEAST(COALESCE(d.doc_count, 0), 5) / 5.0 * 10
    , 2)                                           AS trust_score,
    RANK() OVER (ORDER BY
        COALESCE(AVG(r.score), 0) / 5.0 * 40
      + COALESCE(AVG(r.on_time::int), 0) * 30
      + COALESCE(AVG(r.as_described::int), 0) * 20
      + LEAST(COALESCE(d.doc_count, 0), 5) / 5.0 * 10
    DESC)                                          AS rank
FROM users u
LEFT JOIN user_ratings r ON r.reviewee_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS doc_count
    FROM user_documents WHERE is_verified = TRUE
    GROUP BY user_id
) d ON d.user_id = u.id
WHERE u.role = 'driver'
GROUP BY u.id, u.full_name, d.doc_count;

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_lb_user ON driver_leaderboard(user_id);


-- ── Retailer Leaderboard ──
CREATE MATERIALIZED VIEW IF NOT EXISTS retailer_leaderboard AS
SELECT
    u.id                                           AS user_id,
    u.full_name,
    COUNT(r.id)                                    AS total_ratings,
    ROUND(COALESCE(AVG(r.score), 0)::numeric, 2)  AS avg_score,
    ROUND(
        COALESCE(AVG(r.score), 0) / 5.0 * 40
      + COALESCE(AVG(r.on_time::int), 0) * 30
      + COALESCE(AVG(r.as_described::int), 0) * 20
      + LEAST(COALESCE(d.doc_count, 0), 5) / 5.0 * 10
    , 2)                                           AS trust_score,
    RANK() OVER (ORDER BY
        COALESCE(AVG(r.score), 0) / 5.0 * 40
      + COALESCE(AVG(r.on_time::int), 0) * 30
      + COALESCE(AVG(r.as_described::int), 0) * 20
      + LEAST(COALESCE(d.doc_count, 0), 5) / 5.0 * 10
    DESC)                                          AS rank
FROM users u
LEFT JOIN user_ratings r ON r.reviewee_id = u.id
LEFT JOIN (
    SELECT user_id, COUNT(*) AS doc_count
    FROM user_documents WHERE is_verified = TRUE
    GROUP BY user_id
) d ON d.user_id = u.id
WHERE u.role = 'retailer'
GROUP BY u.id, u.full_name, d.doc_count;

CREATE UNIQUE INDEX IF NOT EXISTS idx_retailer_lb_user ON retailer_leaderboard(user_id);


-- ═══════════════════════════════════════════════════════
--  5. Helper function to refresh all leaderboards
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY producer_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY driver_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY retailer_leaderboard;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════
--  Done! Run SELECT refresh_leaderboards(); after seeding ratings.
-- ═══════════════════════════════════════════════════════
