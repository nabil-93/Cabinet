"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Mic, MicOff, User, Sparkles, Copy, RefreshCw,
  Trash2, AlertCircle, Plus, MessageSquare, ChevronLeft, Menu,
  Paperclip, ImageIcon, FileAudio, X, Loader2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/lib/auth-context";
import { useDashboardStats } from "@/hooks/useDashboard";
import { usePatients } from "@/hooks/usePatients";
import { useAppointments } from "@/hooks/useAppointments";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";

// ─── Types ─────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;    // base64 data URL for display (user upload)
  generatedImages?: string[]; // DALL-E 3 generated image URLs
  audioFile?: string;   // filename for display
  timestamp: Date;
  mode?: "openai" | "demo" | "error";
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
}

// ─── Storage helpers ────────────────────────────────────────────────────────
const STORAGE_KEY = "clinicos-ai-conversations";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((c: any) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  try {
    // Strip base64 imageUrl before persisting to avoid storage quota errors
    const stripped = convs.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({ ...m, imageUrl: undefined })),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
  } catch {}
}

function generateTitle(firstUserMessage: string): string {
  const words = firstUserMessage.trim().split(" ").slice(0, 6).join(" ");
  return words.length > 40 ? words.slice(0, 40) + "..." : words || "Nouvelle conversation";
}

function createNew(): Conversation {
  return {
    id: `conv-${Date.now()}`,
    title: "Nouvelle conversation",
    createdAt: new Date(),
    messages: [
      {
        id: "init",
        role: "assistant",
        content:
          "Bonjour ! Je suis votre assistant médical IA. 🩺\n\nJe me souviens du contexte de chaque conversation. Posez-moi vos questions sur vos patients, vos rendez-vous ou votre cabinet.\n\nComment puis-je vous aider aujourd'hui ?",
        timestamp: new Date(),
        mode: "openai",
      },
    ],
  };
}

// ─── Markdown renderer ──────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function renderContent(content: string) {
  const elements: React.ReactNode[] = [];
  content.split("\n").forEach((line, i) => {
    if (line.trim() === "") { elements.push(<div key={i} className="h-1.5" />); return; }
    if (line.startsWith("• ") || line.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex items-start gap-2 mt-0.5">
          <span className="text-primary mt-1 text-xs flex-shrink-0">•</span>
          <span className="leading-relaxed">{renderInline(line.slice(2))}</span>
        </div>
      );
      return;
    }
    const num = line.match(/^(\d+)\.\s+(.+)/);
    if (num) {
      elements.push(
        <div key={i} className="flex items-start gap-2 mt-0.5">
          <span className="text-primary font-semibold text-xs mt-0.5 flex-shrink-0 w-4">{num[1]}.</span>
          <span className="leading-relaxed">{renderInline(num[2])}</span>
        </div>
      );
      return;
    }
    if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(<p key={i} className="font-bold text-foreground mt-1">{line.slice(2, -2)}</p>);
      return;
    }
    elements.push(<p key={i} className="leading-relaxed">{renderInline(line)}</p>);
  });
  return elements;
}

// ─── Quick actions keys ──────────────────────────────────────────────────────
const QUICK_ACTION_KEYS = [
  { icon: "📅", key: "aiAssistant.quickActions.todayRdv" },
  { icon: "👥", key: "aiAssistant.quickActions.patientSummary" },
  { icon: "💊", key: "aiAssistant.quickActions.prescriptionHelp" },
  { icon: "💰", key: "aiAssistant.quickActions.unpaidInvoices" },
  { icon: "📊", key: "aiAssistant.quickActions.monthlyStats" },
  { icon: "🚨", key: "aiAssistant.quickActions.urgentPatients" },
];

// ─── Main component ─────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const { data: stats } = useDashboardStats();
  const { data: patients } = usePatients(undefined, 50);
  const { data: appointments } = useAppointments();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [apiMode, setApiMode] = useState<"openai" | "demo" | "unknown">("unknown");

  // Attachment state
  const [attachedImage, setAttachedImage] = useState<{ base64: string; preview: string; name: string } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachPopoverOpen, setAttachPopoverOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadConversations();
    if (saved.length > 0) {
      setConversations(saved);
      setActiveId(saved[0].id);
    } else {
      const first = createNew();
      setConversations([first]);
      setActiveId(first.id);
    }
  }, []);

  // Persist on every change
  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations);
  }, [conversations]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAttachPopoverOpen(false);
      }
    }
    if (attachPopoverOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [attachPopoverOpen]);

  const activeConv = conversations.find((c) => c.id === activeId);

  const updateConv = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  const newConversation = () => {
    const conv = createNew();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setInput("");
    setAttachedImage(null);
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        if (filtered.length > 0) setActiveId(filtered[0].id);
        else {
          const fresh = createNew();
          setActiveId(fresh.id);
          return [fresh];
        }
      }
      return filtered;
    });
    toast.info("Conversation supprimée");
  };

  // ─── Image file handler ───────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // dataUrl is "data:image/jpeg;base64,<base64>"
      const base64 = dataUrl.split(",")[1];
      setAttachedImage({ base64, preview: dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  // ─── Audio file handler ───────────────────────────────────────────────────
  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      const res = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.transcript) {
        setInput((prev) => (prev ? prev + " " + data.transcript : data.transcript));
        toast.success("Transcription terminée");
      } else {
        toast.error("Aucun texte transcrit");
      }
    } catch {
      toast.error("Erreur lors de la transcription audio");
    } finally {
      setIsTranscribing(false);
    }
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !activeId) return;

      const imageSnapshot = attachedImage;
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        imageUrl: imageSnapshot ? imageSnapshot.preview : undefined,
        timestamp: new Date(),
      };
      setInput("");
      setAttachedImage(null);
      setLoading(true);

      // Add user msg + update title if first user message
      updateConv(activeId, (c) => ({
        ...c,
        title: c.messages.filter((m) => m.role === "user").length === 0 ? generateTitle(trimmed) : c.title,
        messages: [...c.messages, userMsg],
      }));

      try {
        const conv = conversations.find((c) => c.id === activeId);
        const history = (conv?.messages ?? []).slice(-14).map((m) => ({ role: m.role, content: m.content }));
        history.push({ role: "user", content: trimmed });

        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            language: lang,
            ...(imageSnapshot ? { imageBase64: imageSnapshot.base64 } : {}),
          }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.mode) setApiMode(data.mode === "openai" || data.mode === "claude" ? "openai" : "demo");

        // Open WhatsApp Web if the AI generated a WhatsApp link
        if (data.whatsappUrl) {
          const a = document.createElement("a");
          a.href = data.whatsappUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        const aiMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.message || "Je ne peux pas répondre pour le moment.",
          timestamp: new Date(),
          mode: data.mode,
          generatedImages: data.imageUrls?.length > 0 ? data.imageUrls : undefined,
        };
        updateConv(activeId, (c) => ({ ...c, messages: [...c.messages, aiMsg] }));
      } catch {
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: t("aiAssistant.errorMessage"),
          timestamp: new Date(),
          mode: "error",
        };
        updateConv(activeId, (c) => ({ ...c, messages: [...c.messages, errMsg] }));
        toast.error("Erreur de connexion à l'IA");
      } finally {
        setLoading(false);
      }
    },
    [loading, activeId, conversations, user, stats, patients, appointments, updateConv, attachedImage, lang, t]
  );

  const toggleListening = useCallback(() => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Reconnaissance vocale non supportée"); return; }
    const r = new SR();
    r.lang = "fr-FR"; r.continuous = false; r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = (e: any) => { setListening(false); if (e.error !== "no-speech") toast.error("Erreur microphone"); };
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((x: any) => x[0].transcript).join("");
      setInput(t);
      if (e.results[e.results.length - 1].isFinal) { r.stop(); sendMessage(t); }
    };
    r.start(); recognitionRef.current = r;
  }, [listening, sendMessage]);

  return (
    <div className="flex flex-col h-full">
      <Header title={t("aiAssistant.title")} subtitle={t("aiAssistant.subtitle")} />

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg"
        className="hidden"
        onChange={handleAudioSelect}
      />

      <div className="flex-1 overflow-hidden flex">
        {/* ── Conversations sidebar ── */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-shrink-0 border-r border-border/50 flex flex-col overflow-hidden bg-sidebar"
            >
              {/* New chat button */}
              <div className="p-3 border-b border-border/30">
                <button
                  onClick={newConversation}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {t("aiAssistant.newConversation")}
                </button>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto custom-scroll p-2 space-y-0.5">
                {conversations.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center mt-6">{t("aiAssistant.noConversations")}</p>
                )}
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setActiveId(conv.id)}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                      conv.id === activeId
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <MessageSquare className={cn("w-3.5 h-3.5 flex-shrink-0", conv.id === activeId ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium truncate", conv.id === activeId ? "text-primary" : "text-foreground")}>
                        {conv.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {conv.createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        {" · "}{conv.messages.length} msg
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* API status */}
              <div className="p-3 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
                    apiMode === "openai" ? "bg-emerald-500" : apiMode === "demo" ? "bg-amber-500" : "bg-muted-foreground"
                  )} />
                  <span className="text-[10px] text-muted-foreground">
                    {apiMode === "openai" ? t("aiAssistant.gptActive") : apiMode === "demo" ? t("aiAssistant.demoMode") : t("aiAssistant.waiting")}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Chat area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar with sidebar toggle */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title={sidebarOpen ? "Masquer les conversations" : "Afficher les conversations"}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <span className="text-sm font-medium text-foreground truncate">
              {activeConv?.title || "Nouvelle conversation"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {activeConv?.messages.filter(m => m.role === "user").length ?? 0} messages envoyés
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scroll px-4 md:px-6 py-4 space-y-4">
            {activeConv?.messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-3 group", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm",
                  msg.role === "assistant"
                    ? msg.mode === "error" ? "bg-destructive/10 border border-destructive/20" : "gradient-primary"
                    : "bg-muted border border-border"
                )}>
                  {msg.role === "assistant"
                    ? msg.mode === "error" ? <AlertCircle className="w-4 h-4 text-destructive" /> : <Bot className="w-4 h-4 text-white" />
                    : <User className="w-4 h-4 text-muted-foreground" />}
                </div>

                <div className={cn("max-w-[80%] md:max-w-[72%] flex flex-col gap-1", msg.role === "user" && "items-end")}>
                  <div className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "assistant"
                      ? msg.mode === "error"
                        ? "bg-destructive/5 border border-destructive/20 rounded-tl-sm"
                        : "bg-card border border-border shadow-sm rounded-tl-sm"
                      : "gradient-primary text-white rounded-tr-sm"
                  )}>
                    {/* Image preview inside bubble */}
                    {msg.imageUrl && (
                      <div className="mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.imageUrl}
                          alt="Image jointe"
                          className="rounded-lg max-h-[120px] max-w-[200px] object-cover"
                        />
                      </div>
                    )}
                    <div className="space-y-0.5">{renderContent(msg.content)}</div>

                    {/* DALL-E 3 generated images */}
                    {msg.generatedImages && msg.generatedImages.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.generatedImages.map((url, i) => (
                          <div key={i} className="relative group/img">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Image générée ${i + 1}`}
                              className="rounded-xl w-full max-w-sm object-cover shadow-md border border-border"
                            />
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute bottom-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg"
                            >
                              ↗ Ouvrir
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={cn("flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity", msg.role === "user" && "flex-row-reverse")}>
                    <span className="text-[10px] text-muted-foreground">
                      {msg.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {msg.role === "assistant" && msg.mode !== "error" && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(msg.content).then(() => toast.success("Copié !")); }}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center h-5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          <div className="px-4 md:px-6 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scroll">
              {QUICK_ACTION_KEYS.map((a) => {
                const label = t(a.key);
                return (
                  <button
                    key={a.key}
                    onClick={() => sendMessage(label)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background/50 text-xs text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap disabled:opacity-40 flex-shrink-0"
                  >
                    <span>{a.icon}</span>{label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input area */}
          <div className="px-4 md:px-6 pb-6">
            {/* Image preview chip */}
            <AnimatePresence>
              {attachedImage && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/60 border border-border rounded-xl overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachedImage.preview}
                    alt="Aperçu"
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                  <span className="text-xs text-muted-foreground truncate flex-1">{attachedImage.name}</span>
                  <button
                    onClick={() => setAttachedImage(null)}
                    className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-card border border-border rounded-xl p-3 flex items-end gap-2.5 shadow-sm">
              {/* Microphone (browser speech API) */}
              <button
                onClick={toggleListening}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                  listening ? "bg-red-100 dark:bg-red-900/30 text-red-500 animate-pulse" : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={
                  listening ? t("aiAssistant.listening") :
                  isTranscribing ? t("aiAssistant.transcribing") :
                  t("aiAssistant.placeholder")
                }
                rows={1}
                disabled={loading || isTranscribing}
                style={{ resize: "none", overflowY: "hidden" }}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[36px] max-h-[120px] disabled:opacity-60"
              />

              <div className="flex gap-1.5 flex-shrink-0">
                {/* Attachment popover */}
                <div className="relative" ref={popoverRef}>
                  <button
                    onClick={() => setAttachPopoverOpen((v) => !v)}
                    disabled={isTranscribing}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                      attachPopoverOpen
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      "disabled:opacity-40"
                    )}
                    title="Joindre un fichier"
                  >
                    {isTranscribing
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Paperclip className="w-4 h-4" />
                    }
                  </button>

                  <AnimatePresence>
                    {attachPopoverOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute bottom-11 right-0 w-44 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-20"
                      >
                        <button
                          onClick={() => { setAttachPopoverOpen(false); fileInputRef.current?.click(); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          <ImageIcon className="w-4 h-4 text-primary flex-shrink-0" />
                          {t("aiAssistant.attachImage")}
                        </button>
                        <div className="h-px bg-border/50" />
                        <button
                          onClick={() => { setAttachPopoverOpen(false); audioInputRef.current?.click(); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          <FileAudio className="w-4 h-4 text-primary flex-shrink-0" />
                          {t("aiAssistant.attachAudio")}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* New conversation */}
                <button
                  onClick={newConversation}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                  title={t("aiAssistant.newConversation")}
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* Send */}
                <button
                  onClick={() => sendMessage(input)}
                  disabled={(!input.trim() && !attachedImage) || loading}
                  className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Voice waveform */}
            <AnimatePresence>
              {listening && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 mt-2 px-3">
                  {[...Array(20)].map((_, i) => (
                    <motion.div key={i} className="w-1 rounded-full bg-red-400"
                      animate={{ height: [4, Math.random() * 20 + 8, 4] }}
                      transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, delay: i * 0.05 }} />
                  ))}
                  <span className="ml-2 text-xs text-red-500 font-medium">{t("aiAssistant.listening")}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
