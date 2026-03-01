-- ============================================================
-- Daladan Platform — PostGIS Spatial Tracking Migration
-- ============================================================
-- This migration adds spatial capabilities to the existing
-- database for the greedy routing algorithm.
--
-- Tables affected:
--   • users       → current_location (live driver GPS)
--   • deal_groups → pickup_location  (freight origin point)
--   • shipments   → (already has current_location; add GIST index)
-- ============================================================

-- ─── Step 1: Enable PostGIS Extension ───────────────────────
-- Safe to run if already enabled; CREATE EXTENSION IF NOT EXISTS is idempotent.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Step 2: Add current_location to users ──────────────────
-- Drivers broadcast their GPS position; stored as WGS-84 point.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_location GEOMETRY(Point, 4326);

-- ─── Step 3: Add pickup_location to deal_groups ─────────────
-- Each deal order has a pickup point the driver must reach.
ALTER TABLE public.deal_groups
  ADD COLUMN IF NOT EXISTS pickup_location GEOMETRY(Point, 4326);

-- ─── Step 4: Create GIST Spatial Indexes ────────────────────
-- These indexes allow the greedy routing algorithm to run
-- efficient nearest-neighbour (KNN) and bounding-box queries.

-- Index on users.current_location (for finding nearby drivers)
CREATE INDEX IF NOT EXISTS idx_users_current_location_gist
  ON public.users USING GIST (current_location);

-- Index on deal_groups.pickup_location (for nearest-order lookup)
CREATE INDEX IF NOT EXISTS idx_deal_groups_pickup_location_gist
  ON public.deal_groups USING GIST (pickup_location);

-- Index on shipments.current_location (already exists as a column;
-- this index accelerates live-tracking and ETA queries)
CREATE INDEX IF NOT EXISTS idx_shipments_current_location_gist
  ON public.shipments USING GIST (current_location);

-- ─── Done ───────────────────────────────────────────────────
-- Verify with:  SELECT PostGIS_Full_Version();
--               \d public.users
--               \d public.deal_groups
--               \d public.shipments
