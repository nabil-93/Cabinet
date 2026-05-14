"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Eye, EyeOff, Stethoscope, ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userData = await authService.login({ email, password });
      setUser({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role as any,
        mustChangePassword: userData.mustChangePassword,
        avatarUrl: userData.avatarUrl ?? undefined,
      });
      toast.success("Connexion réussie !");
      if (userData.mustChangePassword) {
        router.push("/change-password");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Email ou mot de passe incorrect";
      setError(msg);
    } finally {
      setLoading(false);
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
            <p className="text-muted-foreground text-sm mt-1.5">Connectez-vous à votre espace médical</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/50 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Adresse email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@clinique.ma" required autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground">Mot de passe</label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">Oublié ?</Link>
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
              <span>Se connecter</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
