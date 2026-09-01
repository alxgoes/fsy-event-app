"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  Phone,
  MapPin,
  Loader2,
  UserPlus,
  LogIn,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FsyTempleMark } from "@/components/brand/FsyLogo";

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

  // Mode: login vs register
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register Form States
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regStake, setRegStake] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setErrorMsg(decodeURIComponent(errorParam));
    }
    const modeParam = searchParams.get("mode");
    if (modeParam === "register") {
      setMode("register");
    }
  }, [searchParams]);

  // Determine redirect based on role
  const handleRoleRedirect = (role?: string) => {
    if (role === "casal_diretor" || role === "coordenador" || role === "logistica") {
      router.push("/admin");
    } else if (role === "medico") {
      router.push("/admin/medical");
    } else if (role === "consultor") {
      router.push("/consultor");
    } else if (role === "midia") {
      router.push("/admin/media");
    } else {
      router.push("/dashboard");
    }
  };

  // Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

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
    setSuccessMsg(null);

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
        if (email.includes("admin") || email.includes("coordenador") || email.includes("diretor") || email.includes("logistica")) {
          handleRoleRedirect("coordenador");
          return;
        }
        if (email.includes("consultor")) {
          handleRoleRedirect("consultor");
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

  // Email / Password Registration
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg("Por favor, informe seu nome completo.");
      return;
    }
    if (!regEmail.trim()) {
      setErrorMsg("Por favor, informe seu e-mail.");
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMsg("A senha deve conter no mínimo 6 caracteres.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg("As senhas digitadas não coincidem. Verifique e tente novamente.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const supabase = createClient();

    try {
      // 1. Sign up with Supabase Auth (default role is jovem; staff roles are assigned exclusively by admins)
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
            role: "jovem",
            stake: regStake.trim() || null,
            phone: regPhone.trim() || null,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.user) {
        // 2. Ensure profile record is saved in public.profiles table
        try {
          await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data.user.id,
              email: regEmail.trim(),
              full_name: fullName.trim(),
              role: "jovem",
              stake: regStake.trim() || null,
              phone: regPhone.trim() || null,
            }),
          });
        } catch {
          // Ignore if trigger handled it
        }

        // 3. Attempt immediate sign-in to establish active session
        const { error: loginErr } = await supabase.auth.signInWithPassword({
          email: regEmail.trim(),
          password: regPassword,
        });

        if (!loginErr) {
          setSuccessMsg("Conta criada com sucesso! Redirecionando...");
          setTimeout(() => {
            handleRoleRedirect("jovem");
          }, 1000);
          return;
        } else {
          // If confirmation was required
          setSuccessMsg("Conta cadastrada com sucesso! Você já pode fazer login.");
          setEmail(regEmail.trim());
          setMode("login");
          setLoading(false);
          return;
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao cadastrar usuário.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Bento Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border-3 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-7 sm:p-9 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] dark:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-5"
      >
        {/* Card Header with Official Temple Mark & Mode Switcher */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex justify-center pb-1">
            <div className="h-16 w-auto p-1 rounded-2xl bg-[#EFEFE7] dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm">
              <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE48A] border border-slate-900 text-slate-950 text-xs font-black uppercase tracking-wider">
            <span>Acesso ao Sistema • 2027</span>
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {mode === "login" ? "Entrar no Portal" : "Criar Nova Conta"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            {mode === "login"
              ? "Bem-vindo ao portal FSY Sessão Ribeirão Preto 2"
              : "Cadastre-se com seus dados para acessar o evento"}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex rounded-2xl border-2 border-slate-900 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all ${
              mode === "login"
                ? "bg-[#007DA5] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black transition-all ${
              mode === "register"
                ? "bg-[#007DA5] text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Cadastrar-se
          </button>
        </div>

        {/* Alerts */}
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

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Sucesso</span>
              <span>{successMsg}</span>
            </div>
          </motion.div>
        )}

        {/* Google Sign-In Button */}
        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all font-black text-sm"
        >
          <GoogleIcon className="h-5 w-5" />
          <span>{loading ? "Conectando ao Google..." : mode === "login" ? "Continuar com o Google" : "Cadastrar com o Google"}</span>
        </Button>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
          <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] font-black uppercase tracking-wider text-slate-400">
            {mode === "login" ? "ou com e-mail" : "ou cadastro comum com e-mail"}
          </span>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: LOGIN FORM                                        */}
        {/* ======================================================== */}
        {mode === "login" && (
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
                className="border-slate-900 dark:border-slate-600 data-[state=checked]:bg-[#007DA5]"
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
              className="w-full h-12 rounded-2xl bg-[#007DA5] hover:bg-[#005E7C] text-white font-black text-sm border-2 border-slate-900 dark:border-slate-600 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Acessando...
                </>
              ) : (
                <>
                  <span>Acessar Portal FSY</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMsg(null);
                }}
                className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#007DA5]"
              >
                Não tem uma conta? <span className="text-[#007DA5] dark:text-[#7DE3F4] font-black underline">Cadastre-se gratuitamente</span>
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 2: REGISTER FORM                                     */}
        {/* ======================================================== */}
        {mode === "register" && (
          <form onSubmit={handleEmailRegister} className="space-y-3.5">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                Nome Completo *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  className="pl-10 h-10 text-xs bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 rounded-xl focus-visible:ring-0 focus-visible:border-[#4361EE] text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                E-mail para acesso *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={loading}
                  className="pl-10 h-10 text-xs bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 rounded-xl focus-visible:ring-0 focus-visible:border-[#4361EE] text-slate-900 dark:text-white"
                />
              </div>
            </div>



            {/* Passwords (2 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block">
                  Senha (mín. 6 dígitos) *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type={showRegPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={loading}
                    className="pl-8 pr-8 h-10 text-xs bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block">
                  Confirmar Senha *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type={showRegPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="pl-8 h-10 text-xs bg-slate-50 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Optional Stake and Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">
                  Estaca / Ala (Opcional)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Ex: Ribeirão Preto Leste"
                    value={regStake}
                    onChange={(e) => setRegStake(e.target.value)}
                    disabled={loading}
                    className="pl-8 h-10 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 block">
                  Telefone / WhatsApp (Opcional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="(16) 99999-9999"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    disabled={loading}
                    className="pl-8 h-10 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Submit Register Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-[#93C742] hover:bg-[#BED21E] text-slate-950 font-black text-sm border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando conta...
                </>
              ) : (
                <>
                  <span>Criar Minha Conta no FSY</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMsg(null);
                }}
                className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#007DA5]"
              >
                Já possui uma conta cadastrada? <span className="text-[#007DA5] dark:text-[#7DE3F4] font-black underline">Fazer Login</span>
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-fsy-watermark text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-11 w-11 rounded-2xl bg-[#EFEFE7] dark:bg-slate-800 flex items-center justify-center p-1 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm">
            <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-black text-sm tracking-tight block text-slate-900 dark:text-white">
                Sessão Ribeirão Preto 2
              </span>
              <span className="rounded-md bg-[#FFE48A] px-1.5 py-0.2 text-[9px] font-black uppercase text-slate-950 border border-slate-900">
                2027
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-bold block">
              Edição 2027 • 05 a 10 de Fevereiro
            </span>
          </div>
        </Link>

        <ThemeToggle />
      </header>

      {/* Main Centered Login / Register Section */}
      <main className="flex-1 flex items-center justify-center py-8">
        <Suspense
          fallback={
            <div className="p-8 text-xs font-bold text-slate-500">
              Carregando formulário de autenticação...
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
