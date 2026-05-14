import api from "./api";
import type { Patient } from "@/types";

export interface CreatePatientDTO {
  fullName: string; phone: string; email?: string;
  dateOfBirth?: string; gender?: string; address?: string;
  bloodType?: string; medicalHistory?: string[]; allergies?: string[];
}

export interface UpdatePatientDTO {
  fullName?: string; phone?: string; email?: string;
  dateOfBirth?: string; gender?: string; address?: string;
  bloodType?: string; medicalHistory?: string[]; allergies?: string[];
  status?: string;  // actif / inactif
  avatarUrl?: string | null;
}

export const patientsService = {
  async getAll(limit?: number): Promise<Patient[]> {
    const url = limit ? `/patients?limit=${limit}` : "/patients";
    const res = await api.get<Patient[]>(url);
    return res.data;
  },

  async getById(id: string): Promise<Patient> {
    const res = await api.get<Patient>(`/patients/${id}`);
    return res.data;
  },

  async search(q: string): Promise<Patient[]> {
    const res = await api.get<Patient[]>(`/patients/search?q=${encodeURIComponent(q)}`);
    return res.data;
  },

  async create(data: CreatePatientDTO): Promise<Patient> {
    const res = await api.post<Patient>("/patients", data);
    return res.data;
  },

  async update(id: string, data: UpdatePatientDTO): Promise<Patient> {
    const res = await api.put<Patient>(`/patients/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/patients/${id}`);
  },
};
