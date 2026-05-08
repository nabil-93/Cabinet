import api from "./api";
import type { Invoice, InvoiceItem } from "@/types";

export interface CreateInvoicePayload {
  patientId: string;
  total: number;
  items?: InvoiceItem[];
  notes?: string;
  dueDate?: string;
  appointmentId?: string;
}

export interface UpdateInvoicePayload {
  total?: number;
  paid?: number;
  notes?: string;
  items?: InvoiceItem[];
  dueDate?: string;
  status?: string;
}

export const invoicesService = {
  async getAll(): Promise<Invoice[]> {
    const res = await api.get<Invoice[]>("/invoices");
    return res.data;
  },

  async getById(id: string): Promise<Invoice> {
    const res = await api.get<Invoice>(`/invoices/${id}`);
    return res.data;
  },

  async create(payload: CreateInvoicePayload): Promise<Invoice> {
    const res = await api.post<Invoice>("/invoices", payload);
    return res.data;
  },

  async update(id: string, payload: UpdateInvoicePayload): Promise<Invoice> {
    const res = await api.patch<Invoice>(`/invoices/${id}`, payload);
    return res.data;
  },

  async pay(id: string, amount: number): Promise<Invoice> {
    const res = await api.patch<Invoice>(`/invoices/${id}/pay`, { amount });
    return res.data;
  },

  async markPaid(id: string): Promise<Invoice> {
    const res = await api.patch<Invoice>(`/invoices/${id}/pay`, {});
    return res.data;
  },
};
