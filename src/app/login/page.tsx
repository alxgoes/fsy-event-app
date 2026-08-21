"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/ui/theme-toggle";

function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setErrorMsg(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  // Determine redirect based on role
  const handleRoleRedirect = (role?: string) => {
    if (
      role === "medico" ||
      role === "logistica" ||
      role === "coordenador" ||
      role === "casal_diretor"
    ) {
      router.push("/admin/medical");
    } else {
      router.push("/dashboard");
    }
  };

  // Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);

    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMsg(`Erro de autenticação Google: ${error.message}`);
        setLoading(false);
      } else if (data?.url) {
        // Redirect browser to Google authentication screen
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao iniciar o login com Google";
      setErrorMsg(message);
      setLoading(false);
    }
  };

  // Email / Password Form Login
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Check if demo email pattern was used
        if (email.includes("medico") || email.includes("doutor")) {
          handleRoleRedirect("medico");
          return;
        }
        if (email.includes("admin") || email.includes("coordenador")) {
          handleRoleRedirect("coordenador");
          return;
        }
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        handleRoleRedirect(profile?.role || "jovem");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao conectar com o servidor.";
      setErrorMsg(message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Login Bento Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border-3 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-7 sm:p-9 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] dark:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6"
      >
        {/* Card Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD166]/30 dark:bg-amber-950/60 border border-slate-900 dark:border-amber-500/40 text-slate-900 dark:text-amber-200 text-xs font-black uppercase tracking-wider">
            <span>Acesso ao Sistema</span>
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Entrar no Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Bem-vindo ao portal FSY Sessão Ribeirão Preto 2
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold"
          >
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Atenção</span>
              <span>{errorMsg}</span>
            </div>
          </motion.div>
        )}

        {/* Prominent Google Sign-In Button */}
        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all font-black text-sm"
        >
          <GoogleIcon className="h-5 w-5" />
          <span>{loading ? "Conectando ao Google..." : "Continuar com o Google"}</span>
        </Button>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
          <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
            ou com e-mail
          </span>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
              E-mail cadastrado
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="email"
                placeholder="exemplo@fsybrasil.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="pl-10 h-11 text-xs bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 rounded-xl focus-visible:ring-0 focus-visible:border-[#4361EE] text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                Senha
              </label>
              <button
                type="button"
                className="text-[11px] font-bold text-[#4361EE] hover:underline"
                onClick={() =>
                  setErrorMsg(
                    "Para redefinir sua senha, solicite suporte à coordenação do FSY."
                  )
                }
              >
                Esqueceu a senha?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pl-10 pr-10 h-11 text-xs bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 rounded-xl focus-visible:ring-0 focus-visible:border-[#4361EE] text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              className="border-slate-900 dark:border-slate-600 data-[state=checked]:bg-[#4361EE]"
            />
            <label
              htmlFor="remember"
              className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer select-none"
            >
              Lembrar de mim neste dispositivo
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-[#4361EE] hover:bg-blue-600 text-white font-black text-sm border-2 border-slate-900 dark:border-slate-600 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <span>{loading ? "Acessando..." : "Acessar Portal FSY"}</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-fsy-watermark text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-9 w-9 rounded-xl bg-[#4361EE] flex items-center justify-center text-white font-black text-xs border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            FSY
          </div>
          <div>
            <span className="font-black text-sm tracking-tight block text-slate-900 dark:text-white">
              Sessão Ribeirão Preto 2
            </span>
            <span className="text-[10px] text-slate-500 font-bold block">
              Edição 2027 (05 a 10 de Fevereiro)
            </span>
          </div>
        </Link>

        <ThemeToggle />
      </header>

      {/* Main Centered Login Section */}
      <main className="flex-1 flex items-center justify-center py-8">
        <Suspense
          fallback={
            <div className="p-8 text-xs font-bold text-slate-500">
              Carregando formulário de login...
            </div>
          }
        >
          <LoginFormContent />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[11px] font-bold text-slate-400">
        © 2027 FSY Sessão Ribeirão Preto 2
      </footer>
    </div>
  );
}
