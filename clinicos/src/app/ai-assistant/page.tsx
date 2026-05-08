"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Send, Mic, MicOff, User, Sparkles, Zap, Copy, RefreshCw, Trash2, AlertCircle
} from "lucide-react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  mode?: "openai" | "demo" | "error";
}

const QUICK_ACTIONS = [
  { icon: "📅", label: "RDV d'aujourd'hui" },
  { icon: "💰", label: "Factures impayées" },
  { icon: "👥", label: "Résumé patients" },
  { icon: "💊", label: "Aide ordonnance" },
  { icon: "📊", label: "Statistiques du mois" },
  { icon: "🚨", label: "Patients urgents" },
];

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "assistant",
  content:
    "Bonjour ! Je suis votre assistant médical IA. 🩺\n\nJe peux vous aider à :\n• Consulter vos rendez-vous et patients\n• Analyser les données de votre cabinet\n• Générer des résumés et rapports\n• Répondre à vos questions médicales\n\nComment puis-je vous aider aujourd'hui ?",
  timestamp: new Date(),
  mode: "openai",
};

// ─── Markdown-like renderer ─────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  // Handle **bold** inline
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    // Empty line → spacer
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
      return;
    }

    // Bullet point (• or - at start)
    if (line.startsWith("• ") || line.startsWith("- ")) {
      const text = line.slice(2);
      elements.push(
        <div key={i} className="flex items-start gap-2 mt-0.5">
          <span className="text-primary mt-1 text-xs flex-shrink-0">•</span>
          <span className="leading-relaxed">{renderInline(text)}</span>
        </div>
      );
      return;
    }

    // Numbered list (1. 2. etc.)
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-2 mt-0.5">
          <span className="text-primary font-semibold text-xs mt-0.5 flex-shrink-0 w-4">{numberedMatch[1]}.</span>
          <span className="leading-relaxed">{renderInline(numberedMatch[2])}</span>
        </div>
      );
      return;
    }

    // Heading line (starts and ends with **)
    if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <p key={i} className="font-bold text-foreground mt-1">{line.slice(2, -2)}</p>
      );
      return;
    }

    // Normal line
    elements.push(
      <p key={i} className="leading-relaxed">{renderInline(line)}</p>
    );
  });

  return elements;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [apiMode, setApiMode] = useState<"openai" | "demo" | "unknown">("unknown");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      // Add user message and clear input
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        // Build history from current messages (NOT including the new userMsg yet since we just set it)
        // We take last 10 messages for context
        const history = messages
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));
        // Add the new user message
        history.push({ role: "user", content: trimmed });

        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            context: {
              user: { name: user?.name, role: user?.role },
              timestamp: new Date().toISOString(),
            },
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        // Track the API mode
        if (data.mode) {
          setApiMode(data.mode === "openai" ? "openai" : "demo");
        }

        const aiMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.message || "Je ne peux pas répondre pour le moment.",
          timestamp: new Date(),
          mode: data.mode,
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        console.error("AI send error:", err);
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content:
            "⚠️ Impossible de contacter l'assistant IA.\n\nVérifiez votre connexion internet et réessayez.\nSi le problème persiste, contactez votre administrateur.",
          timestamp: new Date(),
          mode: "error",
        };
        setMessages((prev) => [...prev, errMsg]);
        toast.error("Erreur de connexion à l'IA");
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, user]
  );

  // Voice recognition
  const toggleListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("La reconnaissance vocale n'est pas supportée par votre navigateur");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (e: any) => {
      setListening(false);
      if (e.error !== "no-speech") {
        toast.error("Erreur microphone : " + e.error);
      }
    };
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        recognition.stop();
        sendMessage(transcript);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  }, [listening, sendMessage]);

  const copyMessage = (content: string) => {
    navigator.clipboard
      .writeText(content)
      .then(() => toast.success("Copié !"))
      .catch(() => toast.error("Impossible de copier"));
  };

  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    toast.info("Conversation effacée");
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Assistant IA" subtitle="Alimenté par intelligence artificielle" />

      <div className="flex-1 overflow-hidden flex gap-0">
        {/* ── Chat area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scroll px-4 md:px-6 py-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 group",
                  msg.role === "user" && "flex-row-reverse"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm",
                    msg.role === "assistant"
                      ? msg.mode === "error"
                        ? "bg-destructive/10 border border-destructive/20"
                        : "gradient-primary"
                      : "bg-muted border border-border"
                  )}
                >
                  {msg.role === "assistant" ? (
                    msg.mode === "error" ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    "max-w-[80%] md:max-w-[70%] flex flex-col gap-1",
                    msg.role === "user" && "items-end"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "assistant"
                        ? msg.mode === "error"
                          ? "bg-destructive/5 border border-destructive/20 text-foreground rounded-tl-sm"
                          : "bg-card border border-border shadow-sm text-foreground rounded-tl-sm"
                        : "gradient-primary text-white rounded-tr-sm"
                    )}
                  >
                    <div className="space-y-0.5 text-sm">
                      {renderContent(msg.content)}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div
                    className={cn(
                      "flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity",
                      msg.role === "user" && "flex-row-reverse"
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {msg.timestamp.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {msg.role === "assistant" && msg.mode !== "error" && (
                      <button
                        onClick={() => copyMessage(msg.content)}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Copier le message"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading bubble */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center h-5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
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
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.label)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background/50 text-xs text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap disabled:opacity-40 flex-shrink-0"
                >
                  <span>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input bar */}
          <div className="px-4 md:px-6 pb-6">
            <div className="bg-card border border-border rounded-xl p-3 flex items-end gap-2.5 shadow-sm">
              {/* Voice button */}
              <button
                onClick={toggleListening}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                  listening
                    ? "bg-red-100 dark:bg-red-900/30 text-red-500 animate-pulse"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title={listening ? "Arrêter l'écoute" : "Commande vocale"}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Text input */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={
                  listening
                    ? "Écoute en cours..."
                    : "Posez une question... (Entrée pour envoyer, Shift+Entrée pour sauter une ligne)"
                }
                rows={1}
                disabled={loading}
                style={{ resize: "none", overflowY: "hidden" }}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[36px] max-h-[120px] disabled:opacity-60"
              />

              {/* Clear + Send */}
              <div className="flex gap-1.5 flex-shrink-0">
                {messages.length > 1 && (
                  <button
                    onClick={clearChat}
                    disabled={loading}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all disabled:opacity-40"
                    title="Effacer la conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
                  title="Envoyer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Voice waveform */}
            <AnimatePresence>
              {listening && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-1.5 mt-2 px-3"
                >
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 rounded-full bg-red-400"
                      animate={{ height: [4, Math.random() * 20 + 8, 4] }}
                      transition={{
                        duration: 0.5 + Math.random() * 0.5,
                        repeat: Infinity,
                        delay: i * 0.05,
                      }}
                    />
                  ))}
                  <span className="ml-2 text-xs text-red-500 font-medium">
                    Écoute en cours...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Right info panel (desktop only) ── */}
        <div className="hidden xl:flex w-72 flex-col p-5 border-l border-border/40 space-y-4 overflow-y-auto custom-scroll">
          {/* Capabilities */}
          <div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Capacités
            </h3>
            {[
              { icon: "🗓️", label: "Planning", desc: "RDV, planning, calendrier" },
              { icon: "👥", label: "Patients", desc: "Dossiers et historiques" },
              { icon: "💊", label: "Ordonnances", desc: "Prescriptions et médicaments" },
              { icon: "📊", label: "Analytique", desc: "Stats et rapports" },
              { icon: "💰", label: "Facturation", desc: "Paiements et factures" },
              { icon: "🔔", label: "Rappels", desc: "Notifications intelligentes" },
            ].map(({ icon, label, desc }) => (
              <div
                key={label}
                className="flex items-start gap-2.5 py-2.5 border-b border-border/30 last:border-0"
              >
                <span className="text-base leading-none mt-0.5">{icon}</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Voice commands */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">Commandes vocales</span>
            </div>
            <div className="space-y-1.5 text-[10px] text-muted-foreground">
              {[
                '"RDV de demain"',
                '"Résumé du patient Benali"',
                '"Factures impayées"',
                '"Statistiques du mois"',
              ].map((cmd) => (
                <div key={cmd} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                  <span>{cmd}</span>
                </div>
              ))}
            </div>
          </div>

          {/* API status */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Statut IA</p>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  apiMode === "openai"
                    ? "bg-emerald-500"
                    : apiMode === "demo"
                    ? "bg-amber-500"
                    : "bg-muted-foreground"
                )}
              />
              <span className="text-[10px] text-muted-foreground">
                {apiMode === "openai"
                  ? "OpenAI GPT-4o Mini connecté"
                  : apiMode === "demo"
                  ? "Mode démo (sans clé API)"
                  : "En attente du premier message..."}
              </span>
            </div>
            {apiMode === "demo" && (
              <p className="text-[9px] text-muted-foreground mt-2 leading-relaxed">
                💡 Ajoutez <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code> dans vos variables d&apos;environnement pour activer l&apos;IA complète.
              </p>
            )}
          </div>

          {/* Tips */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-primary mb-2">💡 Conseils</p>
            <div className="space-y-1.5 text-[10px] text-muted-foreground">
              <p>• Posez des questions en français naturel</p>
              <p>• Shift+Entrée pour passer à la ligne</p>
              <p>• Utilisez le micro pour parler directement</p>
              <p>• Survolez un message pour le copier</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
