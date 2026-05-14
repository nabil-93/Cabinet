"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Locale } from "date-fns";
import {
  Plus, Trash2, Edit2, Loader2, Save, X,
  CreditCard, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp,
} from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";
import { getToday } from "@/lib/date-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber?: string;
  patientId?: string;
  patientName: string;
  date: string;
  total?: number;
  paid?: number;
  status: string;
  notes?: string;
  items?: InvoiceItem[];
  createdAt?: string;
}

interface BillingTabProps {
  patientId: string;
  patientName?: string;
  invoices: Invoice[];
  dateLocale: Locale;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  paid:     { label: "Payée",       className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", icon: CheckCircle2 },
  partial:  { label: "Partiel",     className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",           icon: Clock },
  unpaid:   { label: "Non payée",   className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",       icon: AlertCircle },
  pending:  { label: "En attente",  className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",       icon: Clock },
  overdue:  { label: "En retard",   className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",               icon: AlertCircle },
  refunded: { label: "Remboursée",  className: "bg-muted text-muted-foreground",                                          icon: ChevronDown },
};

// ─── Invoice Form ──────────────────────────────────────────────────────────────

function InvoiceForm({ initial, patientName, onSubmit, onCancel, loading }: {
  initial?: Partial<Invoice>;
  patientName?: string;
  onSubmit: (data: { total: number; notes: string; date: string; items: InvoiceItem[] }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [date, setDate]   = useState(initial?.date ?? getToday());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<InvoiceItem[]>(
    initial?.items && initial.items.length > 0
      ? initial.items
      : [{ description: "Consultation médicale", quantity: 1, unitPrice: 300, total: 300 }]
  );
  const [newDesc, setNewDesc]   = useState("");
  const [newQty, setNewQty]     = useState(1);
  const [newPrice, setNewPrice] = useState(300);

  const total = items.reduce((s, i) => s + i.total, 0);

  const addItem = () => {
    if (!newDesc.trim()) return;
    const t = newQty * newPrice;
    setItems(prev => [...prev, { description: newDesc, quantity: newQty, unitPrice: newPrice, total: t }]);
    setNewDesc(""); setNewQty(1); setNewPrice(300);
  };

  const removeItem = (i: number) => setItems(prev => prev.filter((_, j) => j !== i));

  const updateItem = (i: number, field: keyof InvoiceItem, val: string | number) => {
    setItems(prev => prev.map((item, j) => {
      if (j !== i) return item;
      const updated = { ...item, [field]: field === "description" ? val : Number(val) };
      if (field === "quantity" || field === "unitPrice") {
        updated.total = updated.quantity * updated.unitPrice;
      }
      return updated;
    }));
  };

  return (
    <div className="bg-muted/20 rounded-xl border border-border p-4 space-y-4">
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Items */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Prestations</label>
        <div className="space-y-2 mb-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 bg-card border border-border rounded-lg p-2">
              <input value={item.description} onChange={e => updateItem(i, "description", e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-xs text-foreground focus:outline-none" />
              <input type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)}
                className="w-12 bg-muted/50 rounded px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/40" />
              <span className="text-[10px] text-muted-foreground">×</span>
              <input type="number" value={item.unitPrice} onChange={e => updateItem(i, "unitPrice", e.target.value)}
                className="w-16 bg-muted/50 rounded px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/40" />
              <span className="text-[10px] font-semibold text-foreground w-16 text-right flex-shrink-0">{item.total} MAD</span>
              <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>

        {/* Add item row */}
        <div className="flex items-center gap-2 bg-card border border-dashed border-border rounded-lg p-2">
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Nouvelle prestation..."
            className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
          <input type="number" value={newQty} onChange={e => setNewQty(Number(e.target.value))} min={1}
            className="w-12 bg-muted/50 rounded px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none" />
          <span className="text-[10px] text-muted-foreground">×</span>
          <input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} min={0}
            className="w-16 bg-muted/50 rounded px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none" />
          <button onClick={addItem} disabled={!newDesc.trim()}
            className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg disabled:opacity-40 transition-colors flex-shrink-0">
            <Plus className="w-3 h-3" /> Ajouter
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Remarques..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <span className="text-sm font-bold text-foreground">Total: {total.toLocaleString()} MAD</span>
        <div className="flex gap-2">
          <button onClick={() => onSubmit({ total, notes, date, items })} disabled={loading || items.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {initial?.id ? "Enregistrer" : "Créer la facture"}
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Modal ─────────────────────────────────────────────────────────────

function PayModal({ invoice, onClose, onPay, loading }: {
  invoice: Invoice;
  onClose: () => void;
  onPay: (amount: number) => void;
  loading: boolean;
}) {
  const remaining = (invoice.total ?? 0) - (invoice.paid ?? 0);
  const [amount, setAmount] = useState(remaining);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Enregistrer un paiement</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Facture: <span className="font-mono text-foreground">#{invoice.invoiceNumber}</span></p>
          <p>Total: <span className="font-semibold text-foreground">{(invoice.total ?? 0).toLocaleString()} MAD</span></p>
          <p>Déjà payé: <span className="font-semibold text-emerald-600">{(invoice.paid ?? 0).toLocaleString()} MAD</span></p>
          <p>Restant: <span className="font-semibold text-amber-600">{remaining.toLocaleString()} MAD</span></p>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
            Montant à encaisser (MAD)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              min={0}
              max={remaining}
              className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={() => setAmount(remaining)}
              className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 transition-colors border border-emerald-200 dark:border-emerald-800">
              Solde total
            </button>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onPay(amount)}
            disabled={loading || amount <= 0 || amount > remaining}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Encaisser {amount > 0 ? `${amount.toLocaleString()} MAD` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main BillingTab ──────────────────────────────────────────────────────────

export function BillingTab({ patientId, patientName, invoices, dateLocale }: BillingTabProps) {
  const qc = useQueryClient();

  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice]   = useState<Invoice | null>(null);
  const [createLoading, setCreateLoading]   = useState(false);
  const [editLoading, setEditLoading]       = useState(false);
  const [payLoading, setPayLoading]         = useState(false);
  const [deletingId, setDeletingId]         = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["invoices-all"] });
    qc.invalidateQueries({ queryKey: ["invoices-patient", patientId] });
  };

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  const createInvoice = async (data: { total: number; notes: string; date: string; items: InvoiceItem[] }) => {
    setCreateLoading(true);
    try {
      await api.post("/invoices", { patientId, ...data });
      await invalidate();
      setShowNewInvoice(false);
    } finally {
      setCreateLoading(false);
    }
  };

  const updateInvoice = async (id: string, data: { total: number; notes: string; date: string; items: InvoiceItem[] }) => {
    setEditLoading(true);
    try {
      await api.patch(`/invoices/${id}`, data);
      await invalidate();
      setEditingId(null);
    } finally {
      setEditLoading(false);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Supprimer cette facture ?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/invoices/${id}`);
      await invalidate();
    } finally {
      setDeletingId(null);
    }
  };

  const payInvoice = async (invoice: Invoice, amount: number) => {
    setPayLoading(true);
    try {
      const currentPaid = invoice.paid ?? 0;
      await api.patch(`/invoices/${invoice.id}`, { paid: currentPaid + amount });
      await invalidate();
      setPayingInvoice(null);
    } finally {
      setPayLoading(false);
    }
  };

  // ── Summary ───────────────────────────────────────────────────────────────

  const totalBilled  = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const totalPaid    = invoices.reduce((s, i) => s + (i.paid ?? 0), 0);
  const totalRemain  = totalBilled - totalPaid;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Facturation</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {patientName ? `Factures de ${patientName}` : "Factures du patient"}
            {" · "}{invoices.length} facture{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setShowNewInvoice(v => !v); setEditingId(null); }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
            showNewInvoice ? "bg-muted text-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
          )}>
          {showNewInvoice ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showNewInvoice ? "Annuler" : "Nouvelle facture"}
        </button>
      </div>

      {/* New invoice form */}
      {showNewInvoice && (
        <div className="p-4 border-b border-border/60">
          <InvoiceForm
            patientName={patientName}
            onSubmit={createInvoice}
            onCancel={() => setShowNewInvoice(false)}
            loading={createLoading}
          />
        </div>
      )}

      {/* Summary */}
      {invoices.length > 0 && (
        <div className="px-4 py-3 bg-muted/20 border-b border-border/60 grid grid-cols-3 gap-3">
          {[
            { label: "Total facturé", value: totalBilled,  color: "text-foreground" },
            { label: "Payé",          value: totalPaid,    color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Restant dû",    value: totalRemain,  color: totalRemain > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={cn("text-base font-bold", color)}>{value.toLocaleString()} MAD</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Invoice list */}
      {invoices.length === 0 && !showNewInvoice ? (
        <div className="py-12 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Aucune facture pour ce patient</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {invoices.map(inv => {
            const sc = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.unpaid;
            const StatusIcon = sc.icon;
            const remaining = (inv.total ?? 0) - (inv.paid ?? 0);
            const isPaid = inv.status === "paid";
            const dateStr = inv.date || inv.createdAt;

            if (editingId === inv.id) {
              return (
                <div key={inv.id} className="p-4">
                  <InvoiceForm
                    initial={inv}
                    patientName={patientName}
                    onSubmit={(data) => updateInvoice(inv.id, data)}
                    onCancel={() => setEditingId(null)}
                    loading={editLoading}
                  />
                </div>
              );
            }

            return (
              <div key={inv.id} className={cn("px-4 py-3 hover:bg-accent/30 transition-all")}>
                {/* Invoice row */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {inv.patientName || patientName || "—"}
                      </p>
                      {inv.invoiceNumber && (
                        <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">#{inv.invoiceNumber}</span>
                      )}
                      <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", sc.className)}>
                        <StatusIcon className="w-2.5 h-2.5" /> {sc.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {dateStr ? format(new Date(dateStr), "d MMM yyyy", { locale: dateLocale }) : "—"}
                    </p>
                    {/* Progress bar for partial */}
                    {inv.status === "partial" && (inv.total ?? 0) > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${Math.min(100, ((inv.paid ?? 0) / (inv.total ?? 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground flex-shrink-0">
                          {(inv.paid ?? 0).toLocaleString()}/{(inv.total ?? 0).toLocaleString()} MAD
                        </span>
                      </div>
                    )}
                    {inv.notes && <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">{inv.notes}</p>}
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">{(inv.total ?? 0).toLocaleString()} MAD</p>
                    {remaining > 0 && remaining !== (inv.total ?? 0) && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">reste {remaining.toLocaleString()} MAD</p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  {/* Pay / Partial pay */}
                  {!isPaid && remaining > 0 && (
                    <>
                      <button
                        onClick={() => setPayingInvoice(inv)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg transition-colors">
                        <CheckCircle2 className="w-3 h-3" />
                        {inv.paid && inv.paid > 0 ? "Compléter paiement" : "Encaisser"}
                      </button>
                    </>
                  )}
                  {/* Edit */}
                  <button
                    onClick={() => { setEditingId(inv.id); setShowNewInvoice(false); }}
                    className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/5 hover:bg-primary/15 border border-primary/20 px-2.5 py-1 rounded-lg transition-colors">
                    <Edit2 className="w-3 h-3" /> Modifier
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => deleteInvoice(inv.id)}
                    disabled={deletingId === inv.id}
                    className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50">
                    {deletingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment modal */}
      {payingInvoice && (
        <PayModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onPay={(amount) => payInvoice(payingInvoice, amount)}
          loading={payLoading}
        />
      )}
    </div>
  );
}
