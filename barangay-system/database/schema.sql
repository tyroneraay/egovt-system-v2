-- ============================================================
-- BARANGAY DOCUMENT ISSUANCE SYSTEM
-- Complete PostgreSQL Schema for Supabase
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'resident');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE request_status AS ENUM (
  'pending', 'under_review', 'awaiting_payment', 
  'paid', 'processing', 'ready', 'released', 'rejected'
);
CREATE TYPE payment_method AS ENUM ('gcash', 'walk_in', 'free');
CREATE TYPE payment_status AS ENUM ('pending', 'submitted', 'verified', 'rejected');
CREATE TYPE civil_status_type AS ENUM ('Single', 'Married', 'Widowed', 'Separated');

-- ============================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'resident',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RESIDENT PROFILES
-- ============================================================
CREATE TABLE resident_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  suffix VARCHAR(20),
  address TEXT,
  civil_status civil_status_type,
  date_of_birth DATE,
  phone VARCHAR(20),
  valid_id_url TEXT,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STAFF PROFILES
-- ============================================================
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  position VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT TYPES (lookup table)
-- ============================================================
CREATE TABLE document_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed document types
INSERT INTO document_types (name, fee, description) VALUES
  ('Barangay Clearance', 100.00, 'General-purpose barangay clearance certificate'),
  ('Certificate of Residency', 75.00, 'Proof of residence in the barangay'),
  ('Certificate of Indigency', 0.00, 'Certificate for financial assistance applications'),
  ('Business Permit Clearance', 200.00, 'Clearance for business permit applications'),
  ('Barangay ID', 50.00, 'Official barangay identification card'),
  ('Certificate of Good Moral', 50.00, 'Character reference certificate');

-- ============================================================
-- REQUESTS (core transactional table)
-- ============================================================
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resident_id UUID NOT NULL REFERENCES users(id),
  document_type_id INT NOT NULL REFERENCES document_types(id),
  status request_status NOT NULL DEFAULT 'pending',
  purpose TEXT NOT NULL,
  remarks TEXT,
  rejection_reason TEXT,
  assigned_staff_id UUID REFERENCES users(id),
  fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method payment_method NOT NULL,
  proof_url TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REQUEST DOCUMENTS (generated/uploaded PDFs)
-- ============================================================
CREATE TABLE request_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_draft BOOLEAN NOT NULL DEFAULT TRUE,
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS (append-only)
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES users(id),
  actor_name VARCHAR(200),
  action VARCHAR(100) NOT NULL,
  target_table VARCHAR(50),
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  detail TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_requests_resident_id ON requests(resident_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX idx_requests_assigned_staff ON requests(assigned_staff_id);
CREATE INDEX idx_payments_request_id ON payments(request_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_resident_profiles_user_id ON resident_profiles(user_id);
CREATE INDEX idx_staff_profiles_user_id ON staff_profiles(user_id);
CREATE INDEX idx_resident_profiles_verification ON resident_profiles(verification_status);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_resident_profiles_updated_at BEFORE UPDATE ON resident_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_profiles_updated_at BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STATUS TRANSITION VALIDATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "pending": ["under_review", "rejected"],
    "under_review": ["awaiting_payment", "paid", "rejected"],
    "awaiting_payment": ["paid", "rejected"],
    "paid": ["processing"],
    "processing": ["ready"],
    "ready": ["released"],
    "released": [],
    "rejected": []
  }'::JSONB;
  allowed JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  allowed := valid_transitions->OLD.status::TEXT;
  
  IF allowed IS NULL OR NOT allowed ? NEW.status::TEXT THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_status BEFORE UPDATE OF status ON requests
  FOR EACH ROW EXECUTE FUNCTION validate_status_transition();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_documents ENABLE ROW LEVEL SECURITY;

-- Document types: everyone can read
CREATE POLICY "Document types are viewable by all" ON document_types
  FOR SELECT USING (true);

-- Users: own profile or staff/admin can view all
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Staff and admin can view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );
CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Resident profiles: own or staff/admin
CREATE POLICY "Residents can view own profile" ON resident_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Staff/admin can view all resident profiles" ON resident_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );
CREATE POLICY "Residents can update own profile" ON resident_profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Residents can insert own profile" ON resident_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Staff profiles
CREATE POLICY "Staff can view own profile" ON staff_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin can manage all staff profiles" ON staff_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Requests: residents see own, staff/admin see all
CREATE POLICY "Residents can view own requests" ON requests
  FOR SELECT USING (resident_id = auth.uid());
CREATE POLICY "Staff/admin can view all requests" ON requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );
CREATE POLICY "Residents can insert own requests" ON requests
  FOR INSERT WITH CHECK (resident_id = auth.uid());
CREATE POLICY "Staff/admin can update requests" ON requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );

-- Payments
CREATE POLICY "Residents can view own payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM requests WHERE id = request_id AND resident_id = auth.uid())
  );
CREATE POLICY "Staff/admin can view all payments" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );
CREATE POLICY "Residents can insert payments for own requests" ON payments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM requests WHERE id = request_id AND resident_id = auth.uid())
  );
CREATE POLICY "Staff/admin can update payments" ON payments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );

-- Notifications: own only
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Audit logs: admin only for read, system insert
CREATE POLICY "Admin can view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Request documents
CREATE POLICY "Residents can view own documents" ON request_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM requests WHERE id = request_id AND resident_id = auth.uid())
  );
CREATE POLICY "Staff/admin can manage documents" ON request_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff', 'admin'))
  );

-- ============================================================
-- ENABLE SUPABASE REALTIME on key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- ============================================================
-- STORAGE BUCKETS (run in Supabase Dashboard or via API)
-- ============================================================
-- Bucket: valid-ids       (resident ID uploads)
-- Bucket: payment-proofs  (GCash screenshots)
-- Bucket: documents       (generated PDFs)
-- Note: Create these in Supabase Dashboard > Storage
