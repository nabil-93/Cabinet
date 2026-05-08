import api from "./api";
import type { Appointment, AppointmentStatus } from "@/types";

export interface CreateAppointmentDTO {
  patientId: string; doctorId?: string;
  date: string; time: string; duration?: number;
  type?: string; notes?: string; room?: string;
}

export const appointmentsService = {
  async getAll(): Promise<Appointment[]> {
    const res = await api.get<Appointment[]>("/appointments");
    return res.data;
  },

  async getByDate(date: string): Promise<Appointment[]> {
    const res = await api.get<Appointment[]>(`/appointments?date=${date}`);
    return res.data;
  },

  async getByMonth(month: string): Promise<Appointment[]> {
    const res = await api.get<Appointment[]>(`/appointments?month=${month}`);
    return res.data;
  },

  async getByPatient(patientId: string): Promise<Appointment[]> {
    const res = await api.get<Appointment[]>(`/appointments?patientId=${patientId}`);
    return res.data;
  },

  async create(data: CreateAppointmentDTO): Promise<Appointment> {
    const res = await api.post<Appointment>("/appointments", data);
    return res.data;
  },

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const res = await api.patch<Appointment>(`/appointments/${id}`, { status });
    return res.data;
  },

  async reschedule(id: string, date: string, time?: string): Promise<Appointment> {
    const res = await api.patch<Appointment>(`/appointments/${id}`, { date, time });
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/appointments/${id}`);
  },
};
