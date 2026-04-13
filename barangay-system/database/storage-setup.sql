-- ============================================================
-- SUPABASE STORAGE SETUP
-- Run this AFTER schema.sql in Supabase SQL Editor
-- Creates storage buckets and access policies
-- ============================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('valid-ids', 'valid-ids', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

-- ============================================================
-- VALID-IDS BUCKET POLICIES
-- Residents can upload their own ID, staff/admin can view all
-- ============================================================

-- Anyone authenticated can upload to valid-ids (during registration, service role uploads)
CREATE POLICY "Service role can upload valid IDs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'valid-ids');

-- Public read (so staff can view the uploaded IDs)
CREATE POLICY "Valid IDs are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'valid-ids');

-- Only service role can delete
CREATE POLICY "Service role can delete valid IDs"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'valid-ids');

-- ============================================================
-- PAYMENT-PROOFS BUCKET POLICIES
-- Residents upload GCash proofs, staff/admin can view
-- ============================================================

CREATE POLICY "Authenticated users can upload payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Payment proofs are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'payment-proofs');

CREATE POLICY "Service role can delete payment proofs"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'payment-proofs');

-- ============================================================
-- DOCUMENTS BUCKET POLICIES
-- Staff generates/uploads, residents can download their own
-- ============================================================

CREATE POLICY "Staff can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Documents are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documents');

CREATE POLICY "Service role can delete documents"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'documents');
