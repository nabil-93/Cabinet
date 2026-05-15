"use client";
import { useState, useRef, useEffect } from "react";
import { FileText, Plus, Search, TrendingUp, Clock, CheckCircle, Pencil, X, Download, Trash2, Sheet, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { fr, de } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesService, type CreateInvoicePayload, type UpdateInvoicePayload } from "@/services/invoices.service";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Invoice, InvoiceItem, PaymentStatus } from "@/types";
import { useLang } from "@/lib/i18n";

// ─── Excel export ─────────────────────────────────────────────────────────────
async function exportToExcel(invoices: Invoice[], statusLabel: string, isDE: boolean) {
  const XLSX = await import("xlsx");

  const statusMap: Record<string, string> = {
    paid:     isDE ? "Bezahlt"       : "Payé",
    unpaid:   isDE ? "Unbezahlt"     : "Impayé",
    partial:  isDE ? "Teilweise"     : "Partiel",
    refunded: isDE ? "Erstattet"     : "Remboursé",
    overdue:  isDE ? "Überfällig"    : "En retard",
  };

  const rows = invoices.map(inv => ({
    [isDE ? "Rechnungsnummer" : "N° Facture"]:   inv.invoiceNumber ?? "—",
    [isDE ? "Patient"         : "Patient"]:       inv.patientName  ?? "—",
    [isDE ? "Telefon"         : "Téléphone"]:    inv.patientPhone ?? "—",
    [isDE ? "Datum"           : "Date"]:          inv.date         ?? "—",
    [isDE ? "Fälligkeitsdatum": "Échéance"]:     inv.dueDate      ?? "—",
    [isDE ? "Gesamt (MAD)"    : "Total (MAD)"]:   inv.total        ?? 0,
    [isDE ? "Bezahlt (MAD)"   : "Payé (MAD)"]:    inv.paid         ?? 0,
    [isDE ? "Restbetrag (MAD)": "Reste (MAD)"]:  Math.max(0, (inv.total ?? 0) - (inv.paid ?? 0)),
    [isDE ? "Status"          : "Statut"]:        statusMap[inv.status] ?? inv.status,
  }));

  // Summary row
  const totalTotal   = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const totalPaid    = invoices.reduce((s, i) => s + (i.paid  ?? 0), 0);
  const totalRem     = invoices.reduce((s, i) => s + Math.max(0, (i.total ?? 0) - (i.paid ?? 0)), 0);
  rows.push({
    [isDE ? "Rechnungsnummer" : "N° Facture"]:   "",
    [isDE ? "Patient"         : "Patient"]:       isDE ? "GESAMT" : "TOTAL",
    [isDE ? "Telefon"         : "Téléphone"]:    "",
    [isDE ? "Datum"           : "Date"]:          "",
    [isDE ? "Fälligkeitsdatum": "Échéance"]:     "",
    [isDE ? "Gesamt (MAD)"    : "Total (MAD)"]:   totalTotal,
    [isDE ? "Bezahlt (MAD)"   : "Payé (MAD)"]:    totalPaid,
    [isDE ? "Restbetrag (MAD)": "Reste (MAD)"]:  totalRem,
    [isDE ? "Status"          : "Statut"]:        `${invoices.length} ${isDE ? "Einträge" : "factures"}`,
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = statusLabel.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `ClinicOS-Factures-${statusLabel}-${date}.xlsx`);
  toast.success(isDE ? `${invoices.length} Einträge exportiert` : `${invoices.length} factures exportées`);
}

const DEFAULT_ITEMS: InvoiceItem[] = [
  { description: "Consultation médicale", quantity: 1, unitPrice: 300, total: 300 },
];

function formatDate(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

async function downloadPDF(inv: Invoice) {
  const { jsPDF } = await import("jspdf");
  const items: InvoiceItem[] = Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : DEFAULT_ITEMS;
  const statusLabels: Record<string, string> = { paid: "Payé", unpaid: "Impayé", partial: "Partiel", refunded: "Remboursé" };
  const statusLabel = statusLabels[inv.status] || "Impayé";
  const balance = Math.max(0, (inv.total || 0) - (inv.paid || 0));

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, margin = 18, col2 = 120;

  doc.setFillColor(98, 114, 245);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("ClinicOS", margin, 12);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Cabinet Médical · Casablanca, Maroc", margin, 19);
  doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.text("FACTURE", W - margin, 17, { align: "right" });

  doc.setTextColor(60, 60, 80);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  let y = 40;
  doc.setFont("helvetica", "bold"); doc.text(`N° ${inv.invoiceNumber}`, W - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`Date : ${formatDate(inv.date)}`, W - margin, y + 6, { align: "right" });
  doc.text(`Échéance : ${inv.dueDate ? formatDate(inv.dueDate) : "—"}`, W - margin, y + 12, { align: "right" });

  doc.setFillColor(245, 246, 255);
  doc.roundedRect(margin, y - 4, 78, 30, 3, 3, "F");
  doc.roundedRect(col2, y - 4, 72, 30, 3, 3, "F");

  doc.setFontSize(7); doc.setTextColor(98, 114, 245); doc.setFont("helvetica", "bold");
  doc.text("ÉMETTEUR", margin + 4, y + 3);
  doc.setTextColor(30, 30, 50); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text("Cabinet Médical ClinicOS", margin + 4, y + 10);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 120);
  doc.text("Casablanca, Maroc", margin + 4, y + 17);
  doc.text("contact@clinicos.ma", margin + 4, y + 22);

  doc.setFontSize(7); doc.setTextColor(98, 114, 245); doc.setFont("helvetica", "bold");
  doc.text("PATIENT", col2 + 4, y + 3);
  doc.setTextColor(30, 30, 50); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(inv.patientName || "—", col2 + 4, y + 10);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 120);
  if (inv.patientPhone) doc.text(inv.patientPhone, col2 + 4, y + 17);

  y += 38;
  doc.setFillColor(98, 114, 245);
  doc.rect(margin, y, W - margin * 2, 8, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 3, y + 5.5);
  doc.text("Qté", 128, y + 5.5, { align: "center" });
  doc.text("Prix unit.", 158, y + 5.5, { align: "right" });
  doc.text("Total", W - margin - 2, y + 5.5, { align: "right" });

  y += 8;
  items.forEach((item, i) => {
    if (i % 2 === 0) { doc.setFillColor(248, 249, 255); doc.rect(margin, y, W - margin * 2, 8, "F"); }
    doc.setTextColor(40, 40, 60); doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(item.description || "—", margin + 3, y + 5.5);
    doc.text(String(item.quantity), 128, y + 5.5, { align: "center" });
    doc.text(`${item.unitPrice.toLocaleString("fr-MA")} MAD`, 158, y + 5.5, { align: "right" });
    doc.text(`${item.total.toLocaleString("fr-MA")} MAD`, W - margin - 2, y + 5.5, { align: "right" });
    y += 8;
  });

  y += 6;
  const boxX = W - margin - 75;
  doc.setFillColor(245, 246, 255); doc.roundedRect(boxX, y, 75, 36, 3, 3, "F");
  doc.setFontSize(9); doc.setTextColor(100, 100, 120); doc.setFont("helvetica", "normal");
  doc.text("Sous-total :", boxX + 4, y + 8);
  doc.text("Montant payé :", boxX + 4, y + 16);
  doc.setFont("helvetica", "bold"); doc.setTextColor(40, 40, 60);
  doc.text(`${inv.total?.toLocaleString("fr-MA")} MAD`, boxX + 71, y + 8, { align: "right" });
  doc.setTextColor(22, 163, 74);
  doc.text(`${inv.paid?.toLocaleString("fr-MA")} MAD`, boxX + 71, y + 16, { align: "right" });
  doc.setDrawColor(98, 114, 245); doc.setLineWidth(0.5);
  doc.line(boxX + 4, y + 20, boxX + 71, y + 20);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.setTextColor(98, 114, 245);
  doc.text("Solde :", boxX + 4, y + 30);
  doc.text(`${balance.toLocaleString("fr-MA")} MAD`, boxX + 71, y + 30, { align: "right" });

  y += 46;
  const badgeColors: Record<string, [number, number, number]> = {
    paid: [220, 252, 231], unpaid: [254, 226, 226], partial: [254, 243, 199], refunded: [219, 234, 254],
  };
  const badgeTextColors: Record<string, [number, number, number]> = {
    paid: [22, 101, 52], unpaid: [153, 27, 27], partial: [146, 64, 14], refunded: [29, 78, 216],
  };
  const bc = badgeColors[inv.status] || badgeColors.unpaid;
  const btc = badgeTextColors[inv.status] || badgeTextColors.unpaid;
  doc.setFillColor(...bc); doc.roundedRect(margin, y, 32, 8, 2, 2, "F");
  doc.setTextColor(...btc); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(statusLabel, margin + 16, y + 5.5, { align: "center" });

  if (inv.notes) {
    y += 14;
    doc.setFillColor(248, 249, 255); doc.roundedRect(margin, y, W - margin * 2, 14, 2, 2, "F");
    doc.setTextColor(80, 80, 100); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Notes :", margin + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(inv.notes.slice(0, 120), margin + 3, y + 11);
  }

  doc.setFillColor(98, 114, 245); doc.rect(0, 287, W, 10, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
  doc.text(
    `Document généré par ClinicOS · ${new Date().toLocaleDateString("fr-MA")} · Merci de votre confiance.`,
    W / 2, 293, { align: "center" }
  );

  doc.save(`Facture-${inv.invoiceNumber}.pdf`);
}

interface PatientOption { id: string; fullName: string; phone: string; }

function usePatientSearch(q: string) {
  return useQuery<PatientOption[]>({
    queryKey: ["patients-search", q],
    queryFn: async () => {
      if (q.length < 2) return [];
      const res = await api.get<PatientOption[]>(`/patients/search?q=${encodeURIComponent(q)}`);
      return res.data;
    },
    enabled: q.length >= 2,
    staleTime: 10_000,
  });
}

const DESCRIPTION_VALUES = ["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"];

function ItemsTable({
  items,
  onChange,
  addLineLabel,
}: {
  items: InvoiceItem[];
  onChange: (items: InvoiceItem[]) => void;
  addLineLabel: string;
}) {
  const { t } = useLang();
  const TYPE_LABELS: Record<string, string> = {
    "Consultation": t("appointments.types.consultation"),
    "Suivi":        t("appointments.types.suivi"),
    "Bilan":        t("appointments.types.bilan"),
    "Urgence":      t("appointments.types.urgence"),
    "Vaccination":  t("appointments.types.vaccination"),
    "Contrôle":     t("appointments.types.controle"),
    "Autre":        t("appointments.types.autre"),
  };

  function update(idx: number, field: keyof InvoiceItem, value: string) {
    const next = items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: field === "description" ? value : Number(value) };
      updated.total = updated.quantity * updated.unitPrice;
      return updated;
    });
    onChange(next);
  }

  function addRow() {
    onChange([...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  }

  function removeRow(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
        <span>Description</span><span className="text-center">Qté</span><span className="text-right">P.U.</span><span className="text-right">Total</span><span />
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-1 items-center">
          <select
            value={DESCRIPTION_VALUES.includes(item.description) ? item.description : "Autre"}
            onChange={e => update(idx, "description", e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {DESCRIPTION_VALUES.map(o => <option key={o} value={o}>{TYPE_LABELS[o] ?? o}</option>)}
          </select>
          <input type="number" min="1" value={item.quantity} onChange={e => update(idx, "quantity", e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          <input type="number" min="0" value={item.unitPrice} onChange={e => update(idx, "unitPrice", e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          <span className="text-xs font-semibold text-foreground text-right pr-1">{item.total.toLocaleString("fr-MA")}</span>
          <button type="button" onClick={() => removeRow(idx)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-all">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="text-xs text-primary hover:underline mt-1">
        {addLineLabel}
      </button>
    </div>
  );
}

function CreateInvoiceModal({ onClose, t }: { onClose: () => void; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>(DEFAULT_ITEMS);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: suggestions = [] } = usePatientSearch(patientQuery);
  const total = items.reduce((s, i) => s + i.total, 0);

  const mutation = useMutation({
    mutationFn: (payload: CreateInvoicePayload) => invoicesService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("billing.toastCreated"));
      onClose();
    },
    onError: () => toast.error(t("billing.toastErrorCreate")),
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) { toast.error(t("billing.selectPatient")); return; }
    mutation.mutate({ patientId: selectedPatient.id, total, items, notes: notes || undefined, dueDate: dueDate || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{t("billing.createModal.title")}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div ref={dropdownRef} className="relative">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.createModal.patient")}</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-background/50">
                <span className="text-sm font-medium text-foreground">{selectedPatient.fullName}</span>
                <button type="button" onClick={() => { setSelectedPatient(null); setPatientQuery(""); }}
                  className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <input value={patientQuery} onChange={e => { setPatientQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)} placeholder={t("billing.createModal.searchPatient")}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                {showDropdown && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    {suggestions.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedPatient(p); setPatientQuery(""); setShowDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-all">
                        <span className="font-medium text-foreground">{p.fullName}</span>
                        {p.phone && <span className="text-muted-foreground text-xs ml-2">{p.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.createModal.billingLines")}</label>
            <ItemsTable items={items} onChange={setItems} addLineLabel={t("billing.editModal.addLine")} />
            <div className="mt-3 text-right">
              <span className="text-xs text-muted-foreground">{t("billing.createModal.totalLabel")} </span>
              <span className="text-sm font-bold text-primary">{total.toLocaleString("fr-MA")} MAD</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.createModal.dueDate")}</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.createModal.notes")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={t("common.notesPlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              {t("billing.createModal.cancel")}
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50">
              {mutation.isPending ? t("billing.createModal.creating") : t("billing.createModal.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditInvoiceModal({ invoice, onClose, t }: {
  invoice: Invoice;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<InvoiceItem[]>(
    Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : DEFAULT_ITEMS
  );
  const [notes, setNotes]     = useState(invoice.notes || "");
  const [dueDate, setDueDate] = useState(invoice.dueDate || "");
  const [invoiceDate, setInvoiceDate] = useState(invoice.date || "");
  const [paidAt, setPaidAt]   = useState((invoice as any).paidAt || "");
  const [status, setStatus]   = useState<string>(invoice.status || "unpaid");
  const [paidInput, setPaidInput] = useState(String(invoice.paid || 0));

  const total   = items.reduce((s, i) => s + i.total, 0);
  const paidNum = Math.min(total, Math.max(0, Number(paidInput) || 0));
  const restNum = Math.max(0, total - paidNum);

  function handleStatusChange(s: string) {
    setStatus(s);
    if (s === "paid")     setPaidInput(String(total));
    if (s === "unpaid")   setPaidInput("0");
    if (s === "refunded") setPaidInput("0");
  }

  const mutation = useMutation({
    mutationFn: (payload: UpdateInvoicePayload) => invoicesService.update(invoice.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("billing.toastUpdated"));
      onClose();
    },
    onError: () => toast.error(t("billing.toastErrorUpdate")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const paid = status === "paid" ? total : status === "partial" ? paidNum : 0;
    mutation.mutate({ items, total, paid, status, notes: notes || undefined, dueDate: dueDate || undefined, date: invoiceDate || undefined, paidAt: paidAt || undefined } as any);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">{t("billing.editModal.title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.invoiceNumber} · {invoice.patientName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.editModal.lines")}</label>
            <ItemsTable items={items} onChange={setItems} addLineLabel={t("billing.editModal.addLine")} />
            <div className="mt-3 text-right">
              <span className="text-xs text-muted-foreground">{t("billing.editModal.totalLabel")} </span>
              <span className="text-sm font-bold text-primary">{total.toLocaleString("fr-MA")} MAD</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.editModal.billingDate")}</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.editModal.paymentDate")}</label>
              <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.editModal.status")}</label>
              <select value={status} onChange={e => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="unpaid">{t("billing.status.unpaid")}</option>
                <option value="partial">{t("billing.status.partial")}</option>
                <option value="paid">{t("billing.status.paid")}</option>
                <option value="refunded">{t("billing.status.refunded")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.editModal.dueDate")}</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </div>

          {status === "partial" && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">{t("billing.editModal.partialDetail")}</p>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{t("billing.editModal.partialAmount")}</label>
                <input autoFocus type="number" min="0" step="0.01" max={total} value={paidInput}
                  onChange={e => setPaidInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all" placeholder="0" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-background/60 rounded-lg py-2 px-1">
                  <p className="text-[10px] text-muted-foreground">{t("common.total")}</p>
                  <p className="text-sm font-bold text-foreground">{total.toLocaleString("fr-MA")}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-lg py-2 px-1">
                  <p className="text-[10px] text-emerald-600">{t("common.paid")}</p>
                  <p className="text-sm font-bold text-emerald-600">{paidNum.toLocaleString("fr-MA")}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/50 rounded-lg py-2 px-1">
                  <p className="text-[10px] text-red-500">{t("common.remaining")}</p>
                  <p className="text-sm font-bold text-red-500">{restNum.toLocaleString("fr-MA")}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("billing.editModal.notes")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder={t("billing.editModal.notesPlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50">
              {mutation.isPending ? t("common.saving") : t("billing.editModal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayModal({ invoice, onClose, t }: {
  invoice: Invoice;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const qc = useQueryClient();
  const total       = invoice.total || 0;
  const alreadyPaid = invoice.paid  || 0;
  const remaining   = Math.max(0, total - alreadyPaid);

  const [delta, setDelta] = useState(String(remaining));

  const deltaNum     = Math.max(0, Number(delta) || 0);
  const newTotalPaid = Math.min(total, alreadyPaid + deltaNum);
  const newRemaining = Math.max(0, total - newTotalPaid);
  const willBePaid   = newRemaining === 0 && total > 0;
  const willBePartial = newTotalPaid > 0 && newRemaining > 0;

  const mutation = useMutation({
    mutationFn: (newPaid: number) => invoicesService.pay(invoice.id, newPaid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(willBePaid ? t("billing.toastPaidFull") : t("billing.toastPaidPartial"));
      onClose();
    },
    onError: () => toast.error(t("billing.toastErrorPay")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (deltaNum <= 0) { toast.error(t("billing.invalidAmount")); return; }
    mutation.mutate(newTotalPaid);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">{t("billing.payModal.title")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.patientName} · <span className="font-mono text-primary">{invoice.invoiceNumber}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/30 rounded-xl py-3 px-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("common.total")}</p>
              <p className="text-sm font-bold text-foreground">{total.toLocaleString("fr-MA")}</p>
              <p className="text-[10px] text-muted-foreground">MAD</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl py-3 px-2">
              <p className="text-[10px] text-emerald-600 uppercase tracking-wide mb-1">{t("billing.payModal.alreadyPaid")}</p>
              <p className="text-sm font-bold text-emerald-600">{alreadyPaid.toLocaleString("fr-MA")}</p>
              <p className="text-[10px] text-emerald-600">MAD</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl py-3 px-2">
              <p className="text-[10px] text-red-500 uppercase tracking-wide mb-1">{t("billing.payModal.remainingDue")}</p>
              <p className="text-sm font-bold text-red-500">{remaining.toLocaleString("fr-MA")}</p>
              <p className="text-[10px] text-red-500">MAD</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("billing.payModal.amountReceived")}</label>
              <button type="button" onClick={() => setDelta(String(remaining))}
                className="text-[10px] font-semibold text-primary hover:underline">
                {t("billing.payModal.payAll")}
              </button>
            </div>
            <input autoFocus type="number" min="0" step="0.01" max={remaining} value={delta}
              onChange={e => setDelta(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold text-center text-lg" />
          </div>

          {deltaNum > 0 && (
            <div className={cn(
              "rounded-xl px-4 py-3 border space-y-2 transition-all",
              willBePaid
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
            )}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("billing.payModal.totalAfter")}</span>
                <span className="font-bold text-foreground">{newTotalPaid.toLocaleString("fr-MA")} MAD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("billing.payModal.remaining")}</span>
                <span className={cn("font-bold", willBePaid ? "text-emerald-600" : "text-amber-600")}>
                  {newRemaining.toLocaleString("fr-MA")} MAD
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-current/20 pt-2">
                <span className="text-muted-foreground">{t("billing.payModal.newStatus")}</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  willBePaid ? "badge-confirmed" : willBePartial ? "badge-pending" : "badge-cancelled"
                )}>
                  {willBePaid ? t("billing.payModal.paidFull") : willBePartial ? t("billing.payModal.partial") : t("billing.payModal.unpaid")}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              {t("billing.payModal.cancel")}
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50">
              {mutation.isPending ? t("billing.payModal.processing") : t("billing.payModal.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const qc = useQueryClient();
  const { t, lang } = useLang();
  const dateLocale = lang === "de" ? de : fr;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const STATUS_CONFIG = {
    paid:     { label: t("billing.status.paid"),     cls: "badge-confirmed" },
    unpaid:   { label: t("billing.status.unpaid"),   cls: "badge-cancelled" },
    partial:  { label: t("billing.status.partial"),  cls: "badge-pending" },
    refunded: { label: t("billing.status.refunded"), cls: "badge-completed" },
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("billing.toastDeleted"));
      setDeletingId(null);
    },
    onError: () => toast.error(t("billing.toastErrorDelete")),
  });

  const { data: apiInvoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: invoicesService.getAll,
    staleTime: 30_000,
  });

  const invoices: Invoice[] = apiInvoices || [];

  const filtered = invoices.filter(inv => {
    const matchSearch = search === "" || inv.patientName?.toLowerCase().includes(search.toLowerCase()) || inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = invoices.reduce((s, inv) => s + (inv.paid || 0), 0);
  const pendingAmount = invoices.reduce((s, inv) => s + Math.max(0, (inv.total || 0) - (inv.paid || 0)), 0);
  const paidCount = invoices.filter(i => i.status === "paid").length;

  return (
    <div className="flex flex-col h-full">
      <Header title={t("billing.title")} subtitle={t("billing.subtitle")} />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t("billing.stats.revenue"), value: `${totalRevenue.toLocaleString("fr-MA")} MAD`, icon: TrendingUp, color: "gradient-success",  filter: "paid"   as const, exportKey: "paid"   },
            { label: t("billing.stats.pending"), value: `${pendingAmount.toLocaleString("fr-MA")} MAD`, icon: Clock,       color: "gradient-warning", filter: "unpaid" as const, exportKey: "unpaid" },
            { label: t("billing.stats.paid"),    value: paidCount,        icon: CheckCircle, color: "gradient-primary", filter: "paid"   as const, exportKey: "paid"   },
            { label: t("billing.stats.total"),   value: invoices.length,  icon: FileText,    color: "gradient-purple",  filter: "all"    as const, exportKey: "all"    },
          ].map(({ label, value, icon: Icon, color, filter, exportKey }) => (
            <button key={label}
              onClick={() => {
                setStatusFilter(filter);
                const toExport = exportKey === "all" ? invoices : invoices.filter(i => i.status === exportKey);
                const shortLabel = exportKey === "all" ? "Toutes" : exportKey.charAt(0).toUpperCase() + exportKey.slice(1);
                exportToExcel(toExport, shortLabel, lang === "de");
              }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:shadow-md hover:border-primary/30 transition-all text-left group cursor-pointer">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-foreground text-sm">{isLoading ? "—" : value}</p>
                <p className="text-[10px] text-muted-foreground/60 group-hover:text-emerald-600 transition-colors mt-0.5">↓ Excel</p>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("billing.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
              <option value="all">{t("billing.status.all")}</option>
              <option value="paid">{t("billing.status.paid")}</option>
              <option value="unpaid">{t("billing.status.unpaid")}</option>
              <option value="partial">{t("billing.status.partial")}</option>
            </select>

            {/* Excel export button */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-all"
              >
                <Download className="w-4 h-4" />
                Excel
                <ChevronDown className={cn("w-3 h-3 transition-transform", showExportMenu && "rotate-180")} />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden w-52">
                    {[
                      { key: "all",     label: lang === "de" ? "Alle Rechnungen"         : "Toutes les factures",       color: "text-foreground",    count: invoices.length },
                      { key: "unpaid",  label: lang === "de" ? "Unbezahlte Rechnungen"   : "Factures impayées",         color: "text-red-600",       count: invoices.filter(i => i.status === "unpaid").length },
                      { key: "partial", label: lang === "de" ? "Teilweise bezahlt"        : "Partiellement payées",      color: "text-orange-600",    count: invoices.filter(i => i.status === "partial").length },
                      { key: "paid",    label: lang === "de" ? "Bezahlte Rechnungen"     : "Factures payées",           color: "text-emerald-600",   count: invoices.filter(i => i.status === "paid").length },
                      { key: "current", label: lang === "de" ? "Aktuelle Auswahl"         : "Sélection actuelle",        color: "text-primary",       count: filtered.length },
                    ].map(({ key, label, color, count }) => (
                      <button key={key} onClick={() => {
                        setShowExportMenu(false);
                        const toExport = key === "current" ? filtered : key === "all" ? invoices : invoices.filter(i => i.status === key);
                        const shortLabel = key === "all" ? "Toutes" : key === "current" ? "Selection" : key.charAt(0).toUpperCase() + key.slice(1);
                        exportToExcel(toExport, shortLabel, lang === "de");
                      }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-accent transition-colors">
                        <span className={cn("font-medium", color)}>{label}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm">
              <Plus className="w-4 h-4" /> {t("billing.newInvoice")}
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[700px]">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left">{t("billing.table.number")}</th>
                  <th className="text-left">{t("billing.table.patient")}</th>
                  <th className="text-left hidden md:table-cell">{t("billing.table.createdAt")}</th>
                  <th className="text-left hidden lg:table-cell">{t("billing.table.paidAt")}</th>
                  <th className="text-right">{t("billing.table.total")}</th>
                  <th className="text-right hidden sm:table-cell">{t("billing.table.paid")}</th>
                  <th className="text-right hidden sm:table-cell">{t("billing.table.remaining")}</th>
                  <th className="text-center">{t("billing.table.status")}</th>
                  <th className="text-center">{t("billing.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array(4).fill(null).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                ) : (
                  filtered.map(inv => {
                    const sc = STATUS_CONFIG[inv.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unpaid;
                    const balance = Math.max(0, (inv.total || 0) - (inv.paid || 0));
                    return (
                      <tr key={inv.id}>
                        <td><span className="text-xs font-mono font-medium text-primary">{inv.invoiceNumber}</span></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                              {inv.patientName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-foreground">{inv.patientName}</span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {inv.date ? format(new Date(inv.date), "d MMM yyyy", { locale: dateLocale }) : "—"}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell">
                          <span className={cn("text-xs font-medium", (inv as any).paidAt ? "text-emerald-600" : "text-muted-foreground/50")}>
                            {(inv as any).paidAt ? format(new Date((inv as any).paidAt), "d MMM yyyy", { locale: dateLocale }) : "—"}
                          </span>
                        </td>
                        <td className="text-right"><span className="text-xs font-semibold text-foreground">{inv.total?.toLocaleString("fr-MA")} MAD</span></td>
                        <td className="text-right hidden sm:table-cell"><span className="text-xs font-medium text-emerald-600">{inv.paid?.toLocaleString("fr-MA")} MAD</span></td>
                        <td className="text-right hidden sm:table-cell">
                          <span className={cn("text-xs font-medium", balance > 0 ? "text-red-500" : "text-emerald-600")}>
                            {balance.toLocaleString("fr-MA")} MAD
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", sc.cls)}>{sc.label}</span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => downloadPDF(inv)} title={t("common.download")}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-all text-muted-foreground">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditInvoice(inv)} title={t("common.edit")}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-all text-muted-foreground">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {inv.status !== "paid" && (
                              <button onClick={() => setPayInvoice(inv)}
                                className="text-[10px] px-2 py-1 rounded-lg badge-confirmed font-semibold hover:opacity-80 transition-opacity">
                                {t("billing.pay")}
                              </button>
                            )}
                            <button onClick={() => setDeletingId(inv.id)} title={t("common.delete")}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-500 dark:hover:bg-red-950 dark:hover:border-red-800 transition-all text-muted-foreground">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">{t("billing.noInvoices")}</div>
          )}
        </div>
      </div>

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} t={t} />}
      {editInvoice && <EditInvoiceModal invoice={editInvoice} onClose={() => setEditInvoice(null)} t={t} />}
      {payInvoice && <PayModal invoice={payInvoice} onClose={() => setPayInvoice(null)} t={t} />}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t("billing.deleteConfirm")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{t("billing.deleteWarning")}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
                {t("common.cancel")}
              </button>
              <button onClick={() => deleteMutation.mutate(deletingId)} disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all disabled:opacity-50">
                {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
