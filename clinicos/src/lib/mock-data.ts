import type {
  Patient, Appointment, Invoice, Prescription,
  Notification, WaitingRoomEntry, DashboardStats, RevenueData, Doctor
} from "@/types";

export const mockDoctor: Doctor = {
  id: "doc-1",
  name: "Dr. Karim Bensalem",
  email: "k.bensalem@clinicos.ma",
  role: "doctor",
  specialty: "Cardiologie",
  license: "MED-2019-4521",
  patients: 248,
  phone: "+212 661 234 567",
  createdAt: "2020-03-15",
};

export const mockPatients: Patient[] = [
  { id: "p-1", fullName: "Amina Benali", phone: "+212 660 111 222", email: "amina.benali@email.com", dateOfBirth: "1990-04-12", gender: "female", address: "12 Rue Hassan II, Casablanca", bloodType: "A+", medicalHistory: ["Hypertension", "Diabète type 2"], allergies: ["Pénicilline"], createdAt: "2023-01-10", lastVisit: "2025-04-28", status: "active" },
  { id: "p-2", fullName: "Youssef Alaoui", phone: "+212 662 333 444", email: "y.alaoui@email.com", dateOfBirth: "1985-09-23", gender: "male", address: "45 Avenue Mohammed V, Rabat", bloodType: "O+", medicalHistory: ["Asthme"], allergies: [], createdAt: "2023-03-22", lastVisit: "2025-05-01", status: "active" },
  { id: "p-3", fullName: "Fatima Zahra El Idrissi", phone: "+212 663 555 666", email: "fz.elidrissi@email.com", dateOfBirth: "1978-12-05", gender: "female", address: "8 Rue Al Qods, Marrakech", bloodType: "B+", medicalHistory: ["Migraine chronique"], allergies: ["Aspirine"], createdAt: "2022-11-08", lastVisit: "2025-04-15", status: "active" },
  { id: "p-4", fullName: "Omar Tazi", phone: "+212 664 777 888", email: "o.tazi@email.com", dateOfBirth: "1965-06-18", gender: "male", address: "27 Boulevard Zerktouni, Fès", bloodType: "AB-", medicalHistory: ["Insuffisance cardiaque", "Hypertension"], allergies: ["Sulfamides"], createdAt: "2021-07-14", lastVisit: "2025-04-30", status: "active" },
  { id: "p-5", fullName: "Nadia Cherkaoui", phone: "+212 665 999 000", email: "n.cherkaoui@email.com", dateOfBirth: "1995-02-28", gender: "female", address: "3 Rue Ibn Battouta, Tanger", bloodType: "A-", medicalHistory: [], allergies: [], createdAt: "2024-01-20", lastVisit: "2025-03-10", status: "active" },
  { id: "p-6", fullName: "Mehdi Benkirane", phone: "+212 666 123 789", email: "m.benkirane@email.com", dateOfBirth: "1972-08-14", gender: "male", address: "15 Avenue Hassan II, Agadir", bloodType: "O-", medicalHistory: ["Diabète type 1"], allergies: ["Latex"], createdAt: "2022-05-30", lastVisit: "2025-04-22", status: "inactive" },
  { id: "p-7", fullName: "Sara Mansouri", phone: "+212 667 456 012", email: "s.mansouri@email.com", dateOfBirth: "2000-11-11", gender: "female", address: "6 Rue des Orangers, Meknès", bloodType: "B-", medicalHistory: ["Anémie"], allergies: [], createdAt: "2024-06-01", lastVisit: "2025-05-02", status: "active" },
  { id: "p-8", fullName: "Rachid Ouali", phone: "+212 668 789 345", email: "r.ouali@email.com", dateOfBirth: "1958-03-30", gender: "male", address: "21 Rue de la Paix, Oujda", bloodType: "AB+", medicalHistory: ["Arthrite", "Hypertension"], allergies: ["Pénicilline", "Iode"], createdAt: "2020-09-12", lastVisit: "2025-04-10", status: "active" },
];

export const mockAppointments: Appointment[] = [
  { id: "apt-1", patientId: "p-1", patientName: "Amina Benali", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-06", time: "09:00", duration: 30, type: "Consultation", status: "confirmed", room: "Salle 1" },
  { id: "apt-2", patientId: "p-2", patientName: "Youssef Alaoui", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-06", time: "09:30", duration: 45, type: "Suivi", status: "confirmed", room: "Salle 1" },
  { id: "apt-3", patientId: "p-3", patientName: "Fatima Zahra El Idrissi", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-06", time: "10:30", duration: 30, type: "Bilan", status: "pending", room: "Salle 2" },
  { id: "apt-4", patientId: "p-4", patientName: "Omar Tazi", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-06", time: "11:00", duration: 60, type: "Consultation cardiaque", status: "confirmed", room: "Salle 1", notes: "ECG requis" },
  { id: "apt-5", patientId: "p-5", patientName: "Nadia Cherkaoui", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-06", time: "14:00", duration: 30, type: "Consultation", status: "pending" },
  { id: "apt-6", patientId: "p-7", patientName: "Sara Mansouri", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-07", time: "09:00", duration: 30, type: "Suivi anémie", status: "confirmed" },
  { id: "apt-7", patientId: "p-8", patientName: "Rachid Ouali", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-07", time: "10:00", duration: 45, type: "Bilan annuel", status: "confirmed" },
  { id: "apt-8", patientId: "p-6", patientName: "Mehdi Benkirane", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-05", time: "11:00", duration: 30, type: "Contrôle glycémie", status: "completed" },
  { id: "apt-9", patientId: "p-1", patientName: "Amina Benali", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-04", time: "09:00", duration: 30, type: "Suivi tension", status: "completed" },
  { id: "apt-10", patientId: "p-3", patientName: "Fatima Zahra El Idrissi", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-04-30", time: "14:30", duration: 30, type: "Consultation", status: "cancelled", notes: "Annulé par patient" },
];

export const mockInvoices: Invoice[] = [
  { id: "inv-1", invoiceNumber: "INV-2025-001", patientId: "p-1", patientName: "Amina Benali", date: "2025-05-06", dueDate: "2025-05-20", items: [{ description: "Consultation cardiologie", quantity: 1, unitPrice: 400, total: 400 }, { description: "ECG", quantity: 1, unitPrice: 150, total: 150 }], total: 550, paid: 550, status: "paid" },
  { id: "inv-2", invoiceNumber: "INV-2025-002", patientId: "p-2", patientName: "Youssef Alaoui", date: "2025-05-05", dueDate: "2025-05-19", items: [{ description: "Consultation suivi", quantity: 1, unitPrice: 350, total: 350 }], total: 350, paid: 0, status: "unpaid" },
  { id: "inv-3", invoiceNumber: "INV-2025-003", patientId: "p-4", patientName: "Omar Tazi", date: "2025-05-04", dueDate: "2025-05-18", items: [{ description: "Consultation urgence", quantity: 1, unitPrice: 500, total: 500 }, { description: "Bilan sanguin", quantity: 1, unitPrice: 200, total: 200 }], total: 700, paid: 350, status: "partial" },
  { id: "inv-4", invoiceNumber: "INV-2025-004", patientId: "p-3", patientName: "Fatima Zahra El Idrissi", date: "2025-04-28", dueDate: "2025-05-12", items: [{ description: "Consultation neurologie", quantity: 1, unitPrice: 400, total: 400 }], total: 400, paid: 400, status: "paid" },
  { id: "inv-5", invoiceNumber: "INV-2025-005", patientId: "p-5", patientName: "Nadia Cherkaoui", date: "2025-04-25", dueDate: "2025-05-09", items: [{ description: "Bilan complet", quantity: 1, unitPrice: 600, total: 600 }], total: 600, paid: 0, status: "unpaid" },
];

export const mockPrescriptions: Prescription[] = [
  { id: "prx-1", patientId: "p-1", patientName: "Amina Benali", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-06", diagnosis: "Hypertension artérielle", medications: [{ name: "Amlodipine", dosage: "5mg", frequency: "1x/jour", duration: "3 mois", instructions: "Le matin à jeun" }, { name: "Ramipril", dosage: "10mg", frequency: "1x/jour", duration: "3 mois" }], status: "active" },
  { id: "prx-2", patientId: "p-4", patientName: "Omar Tazi", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-05-04", diagnosis: "Insuffisance cardiaque chronique", medications: [{ name: "Bisoprolol", dosage: "2.5mg", frequency: "1x/jour", duration: "6 mois" }, { name: "Furosémide", dosage: "40mg", frequency: "1x/jour", duration: "1 mois", instructions: "Surveiller kaliémie" }], status: "active" },
  { id: "prx-3", patientId: "p-3", patientName: "Fatima Zahra El Idrissi", doctorId: "doc-1", doctorName: "Dr. Karim Bensalem", date: "2025-04-28", diagnosis: "Migraine chronique", medications: [{ name: "Topiramate", dosage: "50mg", frequency: "2x/jour", duration: "2 mois" }], status: "expired" },
];

export const mockNotifications: Notification[] = [
  { id: "notif-1", title: "Rendez-vous dans 30 minutes", message: "Amina Benali - Consultation à 09:00", type: "appointment", read: false, createdAt: "2025-05-06T08:30:00" },
  { id: "notif-2", title: "Paiement reçu", message: "INV-2025-001 - 550 MAD reçu de Amina Benali", type: "payment", read: false, createdAt: "2025-05-06T08:15:00" },
  { id: "notif-3", title: "Nouveau patient", message: "Sara Mansouri a été enregistrée", type: "system", read: true, createdAt: "2025-05-05T16:00:00" },
  { id: "notif-4", title: "RDV annulé", message: "Fatima El Idrissi a annulé son rendez-vous du 30 avril", type: "appointment", read: true, createdAt: "2025-04-29T10:00:00" },
  { id: "notif-5", title: "Facture impayée", message: "INV-2025-005 - Nadia Cherkaoui - 600 MAD en attente", type: "payment", read: false, createdAt: "2025-05-05T09:00:00" },
];

export const mockWaitingRoom: WaitingRoomEntry[] = [
  { id: "wr-1", patientId: "p-1", patientName: "Amina Benali", appointmentTime: "09:00", waitingSince: "08:50", estimatedWait: 0, status: "in-progress", priority: "normal" },
  { id: "wr-2", patientId: "p-2", patientName: "Youssef Alaoui", appointmentTime: "09:30", waitingSince: "09:20", estimatedWait: 10, status: "waiting", priority: "normal" },
  { id: "wr-3", patientId: "p-3", patientName: "Fatima Zahra El Idrissi", appointmentTime: "10:30", waitingSince: "10:15", estimatedWait: 35, status: "waiting", priority: "urgent" },
];

export const mockDashboardStats: DashboardStats = {
  totalPatients: 248,
  todayAppointments: 12,
  monthlyRevenue: 48500,
  pendingInvoices: 8,
  waitingRoom: 3,
  completedToday: 4,
};

export const mockRevenueData: RevenueData[] = [
  { month: "Déc", revenue: 38200, appointments: 92, newPatients: 12 },
  { month: "Jan", revenue: 41500, appointments: 98, newPatients: 15 },
  { month: "Fév", revenue: 36800, appointments: 87, newPatients: 10 },
  { month: "Mar", revenue: 44200, appointments: 105, newPatients: 18 },
  { month: "Avr", revenue: 46900, appointments: 112, newPatients: 22 },
  { month: "Mai", revenue: 48500, appointments: 118, newPatients: 20 },
];

export const appointmentTypes = [
  "Consultation", "Suivi", "Bilan", "Urgence", "Chirurgie", "Vaccination", "Autre"
];

export const specialties = [
  "Cardiologie", "Neurologie", "Pédiatrie", "Dermatologie", "Orthopédie",
  "Gynécologie", "Ophtalmologie", "ORL", "Médecine générale", "Psychiatrie"
];
