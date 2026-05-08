-- ============================================================
--  ClinicOS — Supabase Schema
--  Colle ce fichier dans : Supabase > SQL Editor > New Query
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles (liés à Supabase Auth) ─────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'doctor'
             CHECK (role IN ('admin','doctor','assistant','patient')),
  phone      TEXT,
  specialty  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-créer un profil à chaque inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'doctor')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Patients ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name        TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  date_of_birth    DATE,
  gender           TEXT CHECK (gender IN ('male','female')),
  address          TEXT,
  blood_type       TEXT,
  medical_history  TEXT[] DEFAULT '{}',
  allergies        TEXT[] DEFAULT '{}',
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  last_visit       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Appointments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id  UUID REFERENCES patients ON DELETE CASCADE,
  doctor_id   UUID REFERENCES profiles ON DELETE SET NULL,
  date        DATE NOT NULL,
  time        TEXT NOT NULL,
  duration    INTEGER DEFAULT 30,
  type        TEXT DEFAULT 'Consultation',
  status      TEXT DEFAULT 'pending'
              CHECK (status IN ('confirmed','pending','cancelled','completed')),
  notes       TEXT,
  room        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Invoices ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  patient_id     UUID REFERENCES patients ON DELETE CASCADE,
  doctor_id      UUID REFERENCES profiles ON DELETE SET NULL,
  date           DATE DEFAULT CURRENT_DATE,
  due_date       DATE,
  total          DECIMAL(10,2) DEFAULT 0,
  paid           DECIMAL(10,2) DEFAULT 0,
  status         TEXT DEFAULT 'unpaid'
                 CHECK (status IN ('paid','unpaid','partial','refunded')),
  notes          TEXT,
  items          JSONB DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Prescriptions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id  UUID REFERENCES patients ON DELETE CASCADE,
  doctor_id   UUID REFERENCES profiles ON DELETE SET NULL,
  date        DATE DEFAULT CURRENT_DATE,
  diagnosis   TEXT,
  medications JSONB DEFAULT '[]',
  notes       TEXT,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','expired')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES profiles ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT DEFAULT 'system'
             CHECK (type IN ('appointment','payment','system','message')),
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Waiting Room ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waiting_room (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id       UUID REFERENCES patients ON DELETE CASCADE,
  appointment_id   UUID REFERENCES appointments ON DELETE SET NULL,
  arrived_at       TIMESTAMPTZ DEFAULT NOW(),
  status           TEXT DEFAULT 'waiting'
                   CHECK (status IN ('waiting','in_progress','done')),
  priority         TEXT DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  estimated_wait   INTEGER DEFAULT 0
);

-- ── Uploaded Documents ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id         UUID REFERENCES patients ON DELETE CASCADE,
  uploaded_by        UUID REFERENCES profiles ON DELETE SET NULL,
  file_name          TEXT NOT NULL,
  original_file_name TEXT,
  file_type          TEXT,
  file_size          BIGINT,
  file_url           TEXT,
  document_type      TEXT DEFAULT 'OTHER',
  description        TEXT,
  uploaded_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  Row Level Security (RLS)
-- ============================================================
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_room        ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_documents  ENABLE ROW LEVEL SECURITY;

-- Politiques : utilisateur authentifié peut tout lire/écrire
CREATE POLICY "auth_all" ON profiles           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON patients           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON appointments       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON invoices           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON prescriptions      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON notifications      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON waiting_room       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON uploaded_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
--  Données de démonstration
-- ============================================================

-- Note: Les users doivent d'abord être créés via Supabase Auth
-- Crée 2 users dans Authentication > Users:
--   doctor@clinicos.ma  / Doctor123!
--   admin@clinicos.ma   / Admin123!
-- Puis remplace les UUIDs ci-dessous par les vrais IDs

-- Patients (pas besoin d'UUID auth)
INSERT INTO patients (full_name, phone, email, date_of_birth, gender, address, blood_type, medical_history, allergies, status) VALUES
('Amina Benali',           '+212 660 111 222', 'amina.benali@email.com',   '1990-04-12', 'female', '12 Rue Hassan II, Casablanca',    'A+',  ARRAY['Hypertension','Diabète type 2'], ARRAY['Pénicilline'], 'active'),
('Youssef Alaoui',         '+212 662 333 444', 'y.alaoui@email.com',       '1985-09-23', 'male',   '45 Avenue Mohammed V, Rabat',    'O+',  ARRAY['Asthme'],                       ARRAY[]::TEXT[],      'active'),
('Fatima Zahra El Idrissi','+212 663 555 666', 'fz.elidrissi@email.com',   '1978-12-05', 'female', '8 Rue Al Qods, Marrakech',        'B+',  ARRAY['Migraine chronique'],           ARRAY['Aspirine'],    'active'),
('Omar Tazi',              '+212 664 777 888', 'o.tazi@email.com',         '1965-06-18', 'male',   '27 Boulevard Zerktouni, Fès',    'AB-', ARRAY['Insuffisance cardiaque'],       ARRAY['Sulfamides'],  'active'),
('Nadia Cherkaoui',        '+212 665 999 000', 'n.cherkaoui@email.com',    '1995-02-28', 'female', '3 Rue Ibn Battouta, Tanger',      'A-',  ARRAY[]::TEXT[],                       ARRAY[]::TEXT[],      'active'),
('Mehdi Benkirane',        '+212 666 123 789', 'm.benkirane@email.com',    '1972-08-14', 'male',   '15 Avenue Hassan II, Agadir',     'O-',  ARRAY['Diabète type 1'],               ARRAY['Latex'],       'inactive'),
('Sara Mansouri',          '+212 667 456 012', 's.mansouri@email.com',     '2000-11-11', 'female', '6 Rue des Orangers, Meknès',     'B-',  ARRAY['Anémie'],                       ARRAY[]::TEXT[],      'active'),
('Rachid Ouali',           '+212 668 789 345', 'r.ouali@email.com',        '1958-03-30', 'male',   '21 Rue de la Paix, Oujda',        'AB+', ARRAY['Arthrite','Hypertension'],      ARRAY['Pénicilline'], 'active');
