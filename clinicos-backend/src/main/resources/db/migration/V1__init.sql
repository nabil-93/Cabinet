-- ============================================================
-- ClinicOS — Initial Schema Migration
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(36) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'DOCTOR',
    phone       VARCHAR(50),
    specialty   VARCHAR(100),
    license     VARCHAR(100),
    avatar      VARCHAR(500),
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id              VARCHAR(36) PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(50)  NOT NULL,
    email           VARCHAR(255),
    date_of_birth   DATE,
    gender          VARCHAR(10),
    address         VARCHAR(500),
    blood_type      VARCHAR(10),
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP,
    last_visit      TIMESTAMP
);

-- Patient allergies (element collection)
CREATE TABLE IF NOT EXISTS patient_allergies (
    patient_id  VARCHAR(36) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    allergies   VARCHAR(255)
);

-- Patient medical history (element collection)
CREATE TABLE IF NOT EXISTS patient_medical_history (
    patient_id      VARCHAR(36) NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medical_history VARCHAR(500)
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id          VARCHAR(36) PRIMARY KEY,
    patient_id  VARCHAR(36) NOT NULL REFERENCES patients(id),
    doctor_id   VARCHAR(36) NOT NULL REFERENCES users(id),
    date        DATE        NOT NULL,
    time        TIME        NOT NULL,
    duration    INTEGER,
    type        VARCHAR(100),
    status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    notes       TEXT,
    room        VARCHAR(50),
    created_at  TIMESTAMP
);

-- Invoice items table (must be before invoices due to FK)
CREATE TABLE IF NOT EXISTS invoice_items (
    id          VARCHAR(36) PRIMARY KEY,
    description VARCHAR(500),
    quantity    INTEGER,
    unit_price  NUMERIC(10, 2),
    total       NUMERIC(10, 2),
    invoice_id  VARCHAR(36)
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id              VARCHAR(36) PRIMARY KEY,
    invoice_number  VARCHAR(50)  NOT NULL UNIQUE,
    patient_id      VARCHAR(36)  REFERENCES patients(id),
    doctor_id       VARCHAR(36)  REFERENCES users(id),
    appointment_id  VARCHAR(36)  REFERENCES appointments(id),
    date            DATE,
    due_date        DATE,
    total           NUMERIC(10, 2),
    paid            NUMERIC(10, 2),
    status          VARCHAR(20)  NOT NULL DEFAULT 'UNPAID',
    notes           TEXT,
    created_at      TIMESTAMP
);

-- Add FK from invoice_items to invoices
ALTER TABLE invoice_items
    ADD CONSTRAINT fk_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    ON DELETE CASCADE;

-- Medications table (must be before prescriptions due to FK)
CREATE TABLE IF NOT EXISTS medications (
    id              VARCHAR(36) PRIMARY KEY,
    name            VARCHAR(255),
    dosage          VARCHAR(100),
    frequency       VARCHAR(100),
    duration        VARCHAR(100),
    instructions    TEXT,
    prescription_id VARCHAR(36)
);

-- Prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id              VARCHAR(36) PRIMARY KEY,
    patient_id      VARCHAR(36) REFERENCES patients(id),
    doctor_id       VARCHAR(36) REFERENCES users(id),
    appointment_id  VARCHAR(36) REFERENCES appointments(id),
    date            DATE,
    diagnosis       TEXT,
    notes           TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP
);

-- Add FK from medications to prescriptions
ALTER TABLE medications
    ADD CONSTRAINT fk_medications_prescription
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    ON DELETE CASCADE;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id          VARCHAR(36) PRIMARY KEY,
    user_id     VARCHAR(36) REFERENCES users(id),
    title       VARCHAR(255),
    message     TEXT,
    type        VARCHAR(30),
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP
);

-- Uploaded documents table
CREATE TABLE IF NOT EXISTS uploaded_documents (
    id                  VARCHAR(36) PRIMARY KEY,
    patient_id          VARCHAR(36) REFERENCES patients(id),
    uploaded_by         VARCHAR(36) REFERENCES users(id),
    file_name           VARCHAR(500),
    original_file_name  VARCHAR(500),
    file_type           VARCHAR(100),
    file_size           BIGINT,
    file_path           VARCHAR(1000),
    document_type       VARCHAR(30),
    description         TEXT,
    uploaded_at         TIMESTAMP
);

-- Waiting room table
CREATE TABLE IF NOT EXISTS waiting_room (
    id                      VARCHAR(36) PRIMARY KEY,
    patient_id              VARCHAR(36) REFERENCES patients(id),
    appointment_id          VARCHAR(36) REFERENCES appointments(id),
    arrived_at              TIMESTAMP,
    status                  VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    priority                VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    estimated_wait_minutes  INTEGER
);

-- ============================================================
-- Seed Data
-- ============================================================

-- Admin user (password: admin123 — BCrypt hash)
INSERT INTO users (id, name, email, password, role, phone, specialty, enabled, created_at)
VALUES (
    'admin-user-001',
    'Admin ClinicOS',
    'admin@clinicos.ma',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq',
    'ADMIN',
    '+212600000000',
    NULL,
    TRUE,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Doctor user (password: doctor123 — BCrypt hash)
INSERT INTO users (id, name, email, password, role, phone, specialty, license, enabled, created_at)
VALUES (
    'doctor-user-001',
    'Dr. Youssef El Alami',
    'doctor@clinicos.ma',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq',
    'DOCTOR',
    '+212661000001',
    'Médecine Générale',
    'MED-2019-0042',
    TRUE,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Second doctor
INSERT INTO users (id, name, email, password, role, phone, specialty, license, enabled, created_at)
VALUES (
    'doctor-user-002',
    'Dr. Fatima Zahrae Moussaoui',
    'fatima@clinicos.ma',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWq',
    'DOCTOR',
    '+212661000002',
    'Cardiologie',
    'MED-2017-0115',
    TRUE,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Patient 1
INSERT INTO patients (id, full_name, phone, email, date_of_birth, gender, address, blood_type, status, created_at)
VALUES (
    'patient-001',
    'Mohammed Benali',
    '+212670000001',
    'mohammed.benali@email.com',
    '1985-03-12',
    'MALE',
    '15 Rue des Roses, Casablanca',
    'A+',
    'ACTIVE',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Patient 2
INSERT INTO patients (id, full_name, phone, email, date_of_birth, gender, address, blood_type, status, created_at)
VALUES (
    'patient-002',
    'Khadija Tazi',
    '+212670000002',
    'khadija.tazi@email.com',
    '1992-07-22',
    'FEMALE',
    '8 Boulevard Mohammed V, Rabat',
    'B+',
    'ACTIVE',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Patient 3
INSERT INTO patients (id, full_name, phone, email, date_of_birth, gender, address, blood_type, status, created_at)
VALUES (
    'patient-003',
    'Amine Cherkaoui',
    '+212670000003',
    NULL,
    '1978-11-05',
    'MALE',
    '22 Avenue Hassan II, Fès',
    'O-',
    'ACTIVE',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Patient 4
INSERT INTO patients (id, full_name, phone, email, date_of_birth, gender, address, blood_type, status, created_at)
VALUES (
    'patient-004',
    'Nadia El Fassi',
    '+212670000004',
    'nadia.elfassi@email.com',
    '2001-01-30',
    'FEMALE',
    '3 Rue Ibn Battouta, Tanger',
    'AB+',
    'ACTIVE',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Patient 5
INSERT INTO patients (id, full_name, phone, email, date_of_birth, gender, address, blood_type, status, created_at)
VALUES (
    'patient-005',
    'Omar Bakkali',
    '+212670000005',
    'omar.bakkali@email.com',
    '1965-09-18',
    'MALE',
    '47 Quartier Hay Riad, Rabat',
    'A-',
    'INACTIVE',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Patient allergies
INSERT INTO patient_allergies (patient_id, allergies) VALUES ('patient-001', 'Pénicilline') ON CONFLICT DO NOTHING;
INSERT INTO patient_allergies (patient_id, allergies) VALUES ('patient-002', 'Aspirine') ON CONFLICT DO NOTHING;
INSERT INTO patient_allergies (patient_id, allergies) VALUES ('patient-002', 'Lactose') ON CONFLICT DO NOTHING;
INSERT INTO patient_allergies (patient_id, allergies) VALUES ('patient-003', 'Codéine') ON CONFLICT DO NOTHING;

-- Patient medical history
INSERT INTO patient_medical_history (patient_id, medical_history) VALUES ('patient-001', 'Hypertension artérielle') ON CONFLICT DO NOTHING;
INSERT INTO patient_medical_history (patient_id, medical_history) VALUES ('patient-001', 'Diabète type 2') ON CONFLICT DO NOTHING;
INSERT INTO patient_medical_history (patient_id, medical_history) VALUES ('patient-003', 'Asthme') ON CONFLICT DO NOTHING;
INSERT INTO patient_medical_history (patient_id, medical_history) VALUES ('patient-005', 'Insuffisance cardiaque') ON CONFLICT DO NOTHING;

-- Sample appointment (today)
INSERT INTO appointments (id, patient_id, doctor_id, date, time, duration, type, status, notes, room, created_at)
VALUES (
    'appt-001',
    'patient-001',
    'doctor-user-001',
    CURRENT_DATE,
    '09:00:00',
    30,
    'Consultation',
    'CONFIRMED',
    'Suivi tensionnel',
    'Salle 1',
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, date, time, duration, type, status, notes, room, created_at)
VALUES (
    'appt-002',
    'patient-002',
    'doctor-user-001',
    CURRENT_DATE,
    '10:00:00',
    45,
    'Consultation',
    'PENDING',
    'Première consultation',
    'Salle 1',
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, patient_id, doctor_id, date, time, duration, type, status, notes, room, created_at)
VALUES (
    'appt-003',
    'patient-003',
    'doctor-user-002',
    CURRENT_DATE,
    '11:00:00',
    60,
    'Bilan cardiaque',
    'CONFIRMED',
    NULL,
    'Salle 2',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Sample invoice
INSERT INTO invoices (id, invoice_number, patient_id, doctor_id, appointment_id, date, due_date, total, paid, status, notes, created_at)
VALUES (
    'inv-001',
    'INV-2026-0001',
    'patient-001',
    'doctor-user-001',
    'appt-001',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    300.00,
    300.00,
    'PAID',
    'Consultation + ordonnance',
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (id, invoice_number, patient_id, doctor_id, date, due_date, total, paid, status, notes, created_at)
VALUES (
    'inv-002',
    'INV-2026-0002',
    'patient-002',
    'doctor-user-001',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '15 days',
    200.00,
    0.00,
    'UNPAID',
    NULL,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Invoice items
INSERT INTO invoice_items (id, description, quantity, unit_price, total, invoice_id)
VALUES ('item-001', 'Consultation médicale', 1, 250.00, 250.00, 'inv-001') ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (id, description, quantity, unit_price, total, invoice_id)
VALUES ('item-002', 'Rédaction ordonnance', 1, 50.00, 50.00, 'inv-001') ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (id, description, quantity, unit_price, total, invoice_id)
VALUES ('item-003', 'Consultation médicale', 1, 200.00, 200.00, 'inv-002') ON CONFLICT (id) DO NOTHING;

-- Sample notification
INSERT INTO notifications (id, user_id, title, message, type, read, created_at)
VALUES (
    'notif-001',
    'doctor-user-001',
    'Nouveau patient',
    'Mohammed Benali a été ajouté à votre liste de patients.',
    'SYSTEM',
    FALSE,
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO notifications (id, user_id, title, message, type, read, created_at)
VALUES (
    'notif-002',
    'doctor-user-001',
    'Rendez-vous confirmé',
    'Le rendez-vous de 09h00 avec Mohammed Benali est confirmé.',
    'APPOINTMENT',
    FALSE,
    NOW()
) ON CONFLICT (id) DO NOTHING;
