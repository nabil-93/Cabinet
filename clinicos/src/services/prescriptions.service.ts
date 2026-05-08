import api from "./api";
import type { Prescription, Medication } from "@/types";

export interface CreatePrescriptionDTO {
  patientId: string;
  diagnosis: string;
  medications: Medication[];
  notes?: string;
  doctorId?: string;
}

export const prescriptionsService = {
  async getAll(): Promise<Prescription[]> {
    const res = await api.get<Prescription[]>("/prescriptions");
    return res.data;
  },
  async create(data: CreatePrescriptionDTO): Promise<Prescription> {
    const res = await api.post<Prescription>("/prescriptions", data);
    return res.data;
  },
  async update(id: string, data: { diagnosis?: string; medications?: any[]; notes?: string; status?: string }): Promise<Prescription> {
    const res = await api.patch(`/prescriptions/${id}`, data);
    return res.data;
  },
  async deletePrescription(id: string): Promise<void> {
    await api.delete(`/prescriptions/${id}`);
  },
};
