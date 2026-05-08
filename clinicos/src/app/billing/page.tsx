"use client";
import { useState, useRef, useEffect } from "react";
import { FileText, Plus, Search, TrendingUp, Clock, CheckCircle, Pencil, X, Download } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Header from "@/components/layout/Header";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesService, type CreateInvoicePayload, type UpdateInvoicePayload } from "@/services/invoices.service";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Invoice, InvoiceItem, PaymentStatus } from "@/types";

const STATUS_CONFIG = {
  paid:     { label: "Payé",      cls: "badge-confirmed" },
  unpaid:   { label: "Impayé",    cls: "badge-cancelled" },
  partial:  { label: "Partiel",   cls: "badge-pending" },
  refunded: { label: "Remboursé", cls: "badge-completed" },
};

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

  // ── Header bar ─────────────────────────────────────────────────────────────
  doc.setFillColor(98, 114, 245);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("ClinicOS", margin, 12);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Cabinet Médical · Casablanca, Maroc", margin, 19);
  doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.text("FACTURE", W - margin, 17, { align: "right" });

  // ── Invoice meta ───────────────────────────────────────────────────────────
  doc.setTextColor(60, 60, 80);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  let y = 40;
  doc.setFont("helvetica", "bold"); doc.text(`N° ${inv.invoiceNumber}`, W - margin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`Date : ${formatDate(inv.date)}`, W - margin, y + 6, { align: "right" });
  doc.text(`Échéance : ${inv.dueDate ? formatDate(inv.dueDate) : "—"}`, W - margin, y + 12, { align: "right" });

  // ── Parties ────────────────────────────────────────────────────────────────
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

  // ── Items table ────────────────────────────────────────────────────────────
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

  // ── Totals box ─────────────────────────────────────────────────────────────
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

  // ── Status badge ───────────────────────────────────────────────────────────
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

  // ── Footer ─────────────────────────────────────────────────────────────────
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

const DESCRIPTION_OPTIONS = [
  "Consultation médicale",
  "Consultation de suivi",
  "Consultation spécialisée",
  "Bilan de santé",
  "Urgence médicale",
  "Vaccination",
  "Radiologie / Imagerie",
  "Analyses biologiques",
  "Acte chirurgical mineur",
  "Soins infirmiers",
  "Kinésithérapie",
  "Prescription médicale",
  "Certificat médical",
  "Téléconsultation",
];

function ItemsTable({
  items,
  onChange,
}: {
  items: InvoiceItem[];
  onChange: (items: InvoiceItem[]) => void;
}) {
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
      <datalist id="desc-options">
        {DESCRIPTION_OPTIONS.map(o => <option key={o} value={o} />)}
      </datalist>
      <div className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
        <span>Description</span><span className="text-center">Qté</span><span className="text-right">P.U.</span><span className="text-right">Total</span><span />
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-1 items-center">
          <input
            value={item.description}
            onChange={e => update(idx, "description", e.target.value)}
            placeholder="Description"
            list="desc-options"
            className="px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <input
            type="number" min="1"
            value={item.quantity}
            onChange={e => update(idx, "quantity", e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <input
            type="number" min="0"
            value={item.unitPrice}
            onChange={e => update(idx, "unitPrice", e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-border bg-background/50 text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <span className="text-xs font-semibold text-foreground text-right pr-1">
            {item.total.toLocaleString("fr-MA")}
          </span>
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="text-xs text-primary hover:underline mt-1"
      >
        + Ajouter une ligne
      </button>
    </div>
  );
}

function CreateInvoiceModal({ onClose }: { onClose: () => void }) {
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
      toast.success("Facture créée avec succès");
      onClose();
    },
    onError: () => toast.error("Erreur lors de la création"),
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
    if (!selectedPatient) { toast.error("Sélectionnez un patient"); return; }
    mutation.mutate({
      patientId: selectedPatient.id,
      total,
      items,
      notes: notes || undefined,
      dueDate: dueDate || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Nouvelle Facture</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div ref={dropdownRef} className="relative">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Patient</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-background/50">
                <span className="text-sm font-medium text-foreground">{selectedPatient.fullName}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedPatient(null); setPatientQuery(""); }}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <input
                  value={patientQuery}
                  onChange={e => { setPatientQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Rechercher un patient..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {showDropdown && suggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    {suggestions.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedPatient(p); setPatientQuery(""); setShowDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-all"
                      >
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
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Lignes de facturation</label>
            <ItemsTable items={items} onChange={setItems} />
            <div className="mt-3 text-right">
              <span className="text-xs text-muted-foreground">Total: </span>
              <span className="text-sm font-bold text-primary">{total.toLocaleString("fr-MA")} MAD</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Échéance</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes optionnelles..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              {mutation.isPending ? "Création..." : "Créer la facture"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditInvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<InvoiceItem[]>(
    Array.isArray(invoice.items) && invoice.items.length > 0 ? invoice.items : DEFAULT_ITEMS
  );
  const [notes, setNotes]   = useState(invoice.notes || "");
  const [dueDate, setDueDate] = useState(invoice.dueDate || "");
  const [status, setStatus] = useState<string>(invoice.status || "unpaid");
  const [paidInput, setPaidInput] = useState(String(invoice.paid || 0));

  const total      = items.reduce((s, i) => s + i.total, 0);
  const paidNum    = Math.min(total, Math.max(0, Number(paidInput) || 0));
  const restNum    = Math.max(0, total - paidNum);

  // Quand le statut change, synchronise paidInput
  function handleStatusChange(s: string) {
    setStatus(s);
    if (s === "paid")    setPaidInput(String(total));
    if (s === "unpaid")  setPaidInput("0");
    if (s === "refunded") setPaidInput("0");
  }

  const mutation = useMutation({
    mutationFn: (payload: UpdateInvoicePayload) => invoicesService.update(invoice.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Facture mise à jour");
      onClose();
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const paid = status === "paid" ? total : status === "partial" ? paidNum : 0;
    mutation.mutate({ items, total, paid, notes: notes || undefined, dueDate: dueDate || undefined, status });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scroll">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Modifier la Facture</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.invoiceNumber} · {invoice.patientName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Items */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Lignes de facturation</label>
            <ItemsTable items={items} onChange={setItems} />
            <div className="mt-3 text-right">
              <span className="text-xs text-muted-foreground">Total: </span>
              <span className="text-sm font-bold text-primary">{total.toLocaleString("fr-MA")} MAD</span>
            </div>
          </div>

          {/* Statut + Échéance */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Statut</label>
              <select value={status} onChange={e => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all">
                <option value="unpaid">Impayé</option>
                <option value="partial">Partiel</option>
                <option value="paid">Payé</option>
                <option value="refunded">Remboursé</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Échéance</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
            </div>
          </div>

          {/* Section paiement partiel */}
          {status === "partial" && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Détail du paiement partiel</p>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Montant payé (MAD)</label>
                <input
                  autoFocus
                  type="number" min="0" step="0.01" max={total}
                  value={paidInput}
                  onChange={e => setPaidInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-background/60 rounded-lg py-2 px-1">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-sm font-bold text-foreground">{total.toLocaleString("fr-MA")}</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-lg py-2 px-1">
                  <p className="text-[10px] text-emerald-600">Payé</p>
                  <p className="text-sm font-bold text-emerald-600">{paidNum.toLocaleString("fr-MA")}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/50 rounded-lg py-2 px-1">
                  <p className="text-[10px] text-red-500">Reste</p>
                  <p className="text-sm font-bold text-red-500">{restNum.toLocaleString("fr-MA")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Notes optionnelles..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50">
              {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const total       = invoice.total || 0;
  const alreadyPaid = invoice.paid  || 0;
  const remaining   = Math.max(0, total - alreadyPaid);

  // delta = montant reçu MAINTENANT (pas cumulatif)
  const [delta, setDelta] = useState(String(remaining));

  const deltaNum     = Math.max(0, Number(delta) || 0);
  const newTotalPaid = Math.min(total, alreadyPaid + deltaNum);
  const newRemaining = Math.max(0, total - newTotalPaid);
  const willBePaid   = newRemaining === 0 && total > 0;
  const willBePartial = newTotalPaid > 0 && newRemaining > 0;

  const mutation = useMutation({
    // On envoie le nouveau TOTAL payé (absolu) à l'API
    mutationFn: (newPaid: number) => invoicesService.pay(invoice.id, newPaid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(willBePaid ? "Facture soldée !" : "Paiement partiel enregistré");
      onClose();
    },
    onError: () => toast.error("Erreur lors du paiement"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (deltaNum <= 0) { toast.error("Montant invalide"); return; }
    mutation.mutate(newTotalPaid);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Encaisser un paiement</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.patientName} · <span className="font-mono text-primary">{invoice.invoiceNumber}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-all">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Recap */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/30 rounded-xl py-3 px-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total</p>
              <p className="text-sm font-bold text-foreground">{total.toLocaleString("fr-MA")}</p>
              <p className="text-[10px] text-muted-foreground">MAD</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl py-3 px-2">
              <p className="text-[10px] text-emerald-600 uppercase tracking-wide mb-1">Déjà payé</p>
              <p className="text-sm font-bold text-emerald-600">{alreadyPaid.toLocaleString("fr-MA")}</p>
              <p className="text-[10px] text-emerald-600">MAD</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl py-3 px-2">
              <p className="text-[10px] text-red-500 uppercase tracking-wide mb-1">Reste dû</p>
              <p className="text-sm font-bold text-red-500">{remaining.toLocaleString("fr-MA")}</p>
              <p className="text-[10px] text-red-500">MAD</p>
            </div>
          </div>

          {/* Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Montant reçu maintenant (MAD)</label>
              <button type="button" onClick={() => setDelta(String(remaining))}
                className="text-[10px] font-semibold text-primary hover:underline">
                Tout payer
              </button>
            </div>
            <input
              autoFocus
              type="number" min="0" step="0.01" max={remaining}
              value={delta}
              onChange={e => setDelta(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold text-center text-lg"
            />
          </div>

          {/* Live calculation */}
          {deltaNum > 0 && (
            <div className={cn(
              "rounded-xl px-4 py-3 border space-y-2 transition-all",
              willBePaid
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
            )}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total payé après :</span>
                <span className="font-bold text-foreground">{newTotalPaid.toLocaleString("fr-MA")} MAD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reste à payer :</span>
                <span className={cn("font-bold", willBePaid ? "text-emerald-600" : "text-amber-600")}>
                  {newRemaining.toLocaleString("fr-MA")} MAD
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-current/20 pt-2">
                <span className="text-muted-foreground">Statut :</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  willBePaid ? "badge-confirmed" : willBePartial ? "badge-pending" : "badge-cancelled"
                )}>
                  {willBePaid ? "Payé ✓" : willBePartial ? "Partiel" : "Impayé"}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-all">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              {mutation.isPending ? "Traitement..." : "Confirmer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  const { data: apiInvoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: invoicesService.getAll,
    staleTime: 30_000,
  });

  const invoices: Invoice[] = apiInvoices || [];

  const filtered = invoices.filter(inv => {
    const matchSearch =
      search === "" ||
      inv.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = invoices.reduce((s, inv) => s + (inv.paid || 0), 0);
  const pendingAmount = invoices.reduce((s, inv) => s + Math.max(0, (inv.total || 0) - (inv.paid || 0)), 0);
  const paidCount = invoices.filter(i => i.status === "paid").length;

  return (
    <div className="flex flex-col h-full">
      <Header title="Facturation" subtitle="Gestion des paiements et factures" />

      <div className="flex-1 overflow-auto custom-scroll p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Revenus perçus", value: `${totalRevenue.toLocaleString("fr-MA")} MAD`, icon: TrendingUp, color: "gradient-success" },
            { label: "En attente", value: `${pendingAmount.toLocaleString("fr-MA")} MAD`, icon: Clock, color: "gradient-warning" },
            { label: "Factures payées", value: paidCount, icon: CheckCircle, color: "gradient-primary" },
            { label: "Total factures", value: invoices.length, icon: FileText, color: "gradient-purple" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-foreground text-sm">{isLoading ? "—" : value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par patient ou numéro..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-border bg-background/50 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="all">Tous</option>
              <option value="paid">Payé</option>
              <option value="unpaid">Impayé</option>
              <option value="partial">Partiel</option>
            </select>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nouvelle facture
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[700px]">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left">Numéro</th>
                  <th className="text-left">Patient</th>
                  <th className="text-left hidden md:table-cell">Date</th>
                  <th className="text-right">Total</th>
                  <th className="text-right hidden sm:table-cell">Payé</th>
                  <th className="text-right hidden sm:table-cell">Reste</th>
                  <th className="text-center">Statut</th>
                  <th className="text-center">Actions</th>
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
                        <td>
                          <span className="text-xs font-mono font-medium text-primary">{inv.invoiceNumber}</span>
                        </td>
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
                            {inv.date ? format(new Date(inv.date), "d MMM yyyy", { locale: fr }) : "—"}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-xs font-semibold text-foreground">{inv.total?.toLocaleString("fr-MA")} MAD</span>
                        </td>
                        <td className="text-right hidden sm:table-cell">
                          <span className="text-xs font-medium text-emerald-600">{inv.paid?.toLocaleString("fr-MA")} MAD</span>
                        </td>
                        <td className="text-right hidden sm:table-cell">
                          <span className={cn("text-xs font-medium", balance > 0 ? "text-red-500" : "text-emerald-600")}>
                            {balance.toLocaleString("fr-MA")} MAD
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", sc.cls)}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => downloadPDF(inv)}
                              title="Télécharger PDF"
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-all text-muted-foreground"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditInvoice(inv)}
                              title="Modifier"
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-accent transition-all text-muted-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {inv.status !== "paid" && (
                              <button
                                onClick={() => setPayInvoice(inv)}
                                className="text-[10px] px-2 py-1 rounded-lg badge-confirmed font-semibold hover:opacity-80 transition-opacity"
                              >
                                Payer
                              </button>
                            )}
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
            <div className="py-12 text-center text-sm text-muted-foreground">Aucune facture trouvée</div>
          )}
        </div>
      </div>

      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} />}
      {editInvoice && <EditInvoiceModal invoice={editInvoice} onClose={() => setEditInvoice(null)} />}
      {payInvoice && <PayModal invoice={payInvoice} onClose={() => setPayInvoice(null)} />}
    </div>
  );
}
