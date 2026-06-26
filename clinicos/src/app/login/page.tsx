"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Eye, EyeOff, Stethoscope, ArrowRight, Lock, Mail, AlertCircle, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const QUICK_ACCOUNTS = [
  { label: "Admin", email: "admin@clinicos.ma", password: "Admin123!", icon: ShieldCheck },
  { label: "Sekretärin", email: "secretaire@clinicos.ma", password: "secretaire1", icon: UserCog },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function doLogin(loginEmail: string, loginPassword: string) {
    setError("");
    try {
      const userData = await authService.login({ email: loginEmail, password: loginPassword });
      setUser({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role as any,
        mustChangePassword: userData.mustChangePassword,
        avatarUrl: userData.avatarUrl ?? undefined,
      });
      toast.success("Anmeldung erfolgreich!");
      if (userData.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "E-Mail oder Passwort falsch";
      setError(msg);
      throw err;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await doLogin(email, password);
    } catch {
      // erreur déjà affichée
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickLogin(account: typeof QUICK_ACCOUNTS[number]) {
    setQuickLoading(account.email);
    try {
      await doLogin(account.email, account.password);
    } catch {
      // erreur déjà affichée
    } finally {
      setQuickLoading(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md px-4">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">ClinicOS</h1>
            <p className="text-muted-foreground text-sm mt-1.5">Melden Sie sich in Ihrem medizinischen Bereich an</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/50 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">E-Mail-Adresse</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@praxis.de" required autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground">Passwort</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">Vergessen?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={loading}
              disabled={!email || !password}
              className="w-full gradient-primary mt-2"
            >
              <span>Anmelden</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">Schnellzugriff</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {QUICK_ACCOUNTS.map((account) => {
              const Icon = account.icon;
              const isLoadingThis = quickLoading === account.email;
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleQuickLogin(account)}
                  disabled={quickLoading !== null || loading}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-background/50 text-xs font-semibold text-foreground hover:bg-accent hover:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingThis ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span>{account.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
