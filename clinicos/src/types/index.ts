export type UserRole = "admin" | "doctor" | "assistant" | "patient";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  createdAt: string;
}

export interface Doctor extends User {
  specialty: string;
  license: string;
  patients: number;
}

export interface Patient {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: "male" | "female";
  address: string;
  bloodType?: string;
  medicalHistory: string[];
  allergies: string[];
  createdAt: string;
  lastVisit?: string;
  avatar?: string;
  status: "active" | "inactive";
}

export type AppointmentStatus = "confirmed" | "pending" | "cancelled" | "completed";

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  doctorId: string;
  doctorName: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: AppointmentStatus;
  notes?: string;
  room?: string;
}

export type PaymentStatus = "paid" | "unpaid" | "partial" | "refunded";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  date: string;
  dueDate?: string;
  items: InvoiceItem[];
  total: number;
  paid: number;
  status: PaymentStatus;
  notes?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  diagnosis: string;
  medications: Medication[];
  notes?: string;
  status: "active" | "expired";
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "appointment" | "payment" | "system" | "message";
  read: boolean;
  createdAt: string;
  userId?: string;
}

export interface WaitingRoomEntry {
  id: string;
  patientId: string;
  patientName: string;
  appointmentTime: string;
  waitingSince: string;
  estimatedWait: number;
  status: "waiting" | "in-progress" | "done";
  priority: "normal" | "urgent";
}

export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  monthlyRevenue: number;
  pendingInvoices: number;
  waitingRoom: number;
  completedToday: number;
}

export interface RevenueData {
  month: string;
  revenue: number;
  appointments: number;
  newPatients: number;
}
