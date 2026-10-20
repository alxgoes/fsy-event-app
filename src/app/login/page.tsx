"use client";
import { EVENT_THEME } from "@/lib/event/identity";
import { startTransition } from "react";


import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserPlus,
  LogIn,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Field, PasswordInput } from "@/components/ui/field";
import { passwordProblem } from "@/lib/auth/password-policy";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FsyTempleMark, FsyFloatingLetters } from "@/components/brand/FsyLogo";

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

type Mode = "login" | "register" | "recover";

function LoginFormContent() {
  const router = useRouter();

  // Mode: login vs register
  const [mode, setMode] = useState<Mode>("login");
  const [recoverEmail, setRecoverEmail] = useState("");

  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register Form States
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regStake, setRegStake] = useState("");
  const [regPhone, setRegPhone] = useState("");

  // UI States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");
      if (errorParam) {
        startTransition(() => { setErrorMsg(decodeURIComponent(errorParam)); });
      }
      const modeParam = params.get("mode") || params.get("modo");
      if (modeParam === "register") startTransition(() => { setMode("register"); });
      if (modeParam === "recuperar") startTransition(() => { setMode("recover"); });
      if (params.get("senha") === "redefinida") startTransition(() => { setSuccessMsg("Senha alterada. Entre com a nova senha."); });
    }
  }, []);

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
        setErrorMsg(
          error.message.toLowerCase().includes("email not confirmed")
            ? "Confirme seu e-mail pelo link que enviamos antes de entrar."
            : "E-mail ou senha incorretos. Confira os dados ou use “Esqueci minha senha”."
        );
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

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(recoverEmail.trim())) {
      setErrorMsg("Informe o e-mail usado no cadastro.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoverEmail.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setErrorMsg(json.error || "Não foi possível enviar agora. Tente novamente em instantes.");
      else setSuccessMsg(json.message);
    } catch {
      setErrorMsg("Sem conexão. Verifique a internet e tente novamente.");
    } finally {
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
    const problem = passwordProblem(regPassword);
    if (problem) {
      setErrorMsg(problem);
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
            stake: regStake.trim() || null,
            phone: regPhone.trim() || null,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.user && data.session) {
        // O perfil é criado pelo banco com cargo "jovem"; aqui só complementamos os dados da própria conta.
        await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: fullName.trim(),
            stake: regStake.trim() || null,
            phone: regPhone.trim() || null,
          }),
        }).catch(() => undefined);
        setSuccessMsg("Conta criada. Redirecionando...");
        setTimeout(() => handleRoleRedirect("jovem"), 800);
        return;
      }

      if (data?.user) {
        // Projeto com confirmação de e-mail: não há sessão até a pessoa abrir o link.
        setSuccessMsg("Conta criada. Enviamos um link de confirmação para o seu e-mail; abra-o para entrar.");
        setEmail(regEmail.trim());
        setMode("login");
        setLoading(false);
        return;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao cadastrar usuário.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const isRecover = mode === "recover";
  const heading = mode === "login" ? "Entrar no Portal" : mode === "register" ? "Criar conta" : "Recuperar acesso";
  const subtitle =
    mode === "login"
      ? "Portal da Sessão Ribeirão Preto 2"
      : mode === "register"
        ? "Cadastro de participante. Cargos da equipe são atribuídos pela coordenação."
        : "Enviaremos um link para criar uma nova senha do portal.";

  return (
    <div className="w-full max-w-md">
      <section
        aria-labelledby="login-heading"
        className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 sm:p-8"
      >
        <div className="space-y-2 text-center">
          <div className="mx-auto flex items-center justify-center pb-1">
            <FsyFloatingLetters size="md" />
          </div>
          <p className="inline-flex items-center rounded-full bg-[#FFE48A] px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-950">
            {EVENT_THEME} · 2027
          </p>
          <h1 id="login-heading" className="font-heading text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {heading}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
        </div>

        {!isRecover && (
          <div role="tablist" aria-label="Escolha entre entrar ou criar conta" className="flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
            {([
              ["login", "Entrar", LogIn],
              ["register", "Cadastrar-se", UserPlus],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  mode === value
                    ? "bg-[#007DA5] text-white shadow-sm dark:bg-[#01B6D1] dark:text-slate-950 dark:text-slate-950"
                    : "text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        )}

        <div aria-live="polite" className="space-y-2">
          {errorMsg && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-[#F4B4A8] bg-[#FDF1EE] p-3.5 text-sm text-[#7A1F12] dark:border-[#7A2E22] dark:bg-[#2A1410] dark:text-[#FFD2C8]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div role="status" className="flex items-start gap-2.5 rounded-xl border border-[#BFE3A0] bg-[#F2FAEA] p-3.5 text-sm text-[#2F5413] dark:border-[#3D5A22] dark:bg-[#14210B] dark:text-[#D6F0BC]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {!isRecover && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              <GoogleIcon className="h-5 w-5" />
              <span>{loading ? "Conectando ao Google…" : mode === "login" ? "Continuar com o Google" : "Cadastrar com o Google"}</span>
            </Button>
            <div className="relative flex items-center justify-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              <span className="absolute bg-white px-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                ou com e-mail
              </span>
            </div>
          </>
        )}

        {mode === "login" && (
          <form onSubmit={handleEmailSignIn} className="space-y-4" noValidate>
            <Field id="login-email" label="E-mail">
              {(a) => (
                <Input {...a} type="email" inputMode="email" autoComplete="email" placeholder="nome@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
              )}
            </Field>
            <div className="space-y-1.5">
              <Field id="login-password" label="Senha">
                {(a) => (
                  <PasswordInput {...a} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
                )}
              </Field>
              <div className="flex justify-end">
                <button type="button" onClick={() => { setRecoverEmail(email); switchMode("recover"); }} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#005E7C] dark:text-[#7DE3F4] underline-offset-4 hover:underline">
                  Esqueci minha senha
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-sm font-semibold">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {loading ? "Entrando…" : "Entrar no portal"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
            </Button>
          </form>
        )}

        {mode === "recover" && (
          <form onSubmit={handleRecover} className="space-y-4" noValidate>
            <Field id="recover-email" label="E-mail da conta" hint="Contas criadas só com Google: o link cria uma senha do portal para o mesmo cadastro. A senha do Google não muda.">
              {(a) => (
                <Input {...a} type="email" inputMode="email" autoComplete="email" placeholder="nome@exemplo.com" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} disabled={loading} />
              )}
            </Field>
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-sm font-semibold">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="mr-2 h-4 w-4" aria-hidden="true" />}
              {loading ? "Enviando…" : "Enviar link de redefinição"}
            </Button>
            <button type="button" onClick={() => switchMode("login")} className="flex min-h-11 w-full items-center justify-center text-sm font-semibold text-slate-700 hover:text-[#005E7C] dark:text-slate-200 dark:hover:text-[#7DE3F4]">
              Voltar para a entrada
            </button>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleEmailRegister} className="space-y-4" noValidate>
            <Field id="register-fullname" label="Nome completo" required>
              {(a) => <Input {...a} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />}
            </Field>
            <Field id="register-email" label="E-mail" required>
              {(a) => <Input {...a} type="email" inputMode="email" autoComplete="email" placeholder="nome@exemplo.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} disabled={loading} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="register-stake" label="Estaca">
                {(a) => <Input {...a} autoComplete="off" placeholder="Ex.: Ribeirão Preto Leste" value={regStake} onChange={(e) => setRegStake(e.target.value)} disabled={loading} />}
              </Field>
              <Field id="register-phone" label="Celular">
                {(a) => <Input {...a} type="tel" inputMode="tel" autoComplete="tel" placeholder="(16) 99999-0000" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} disabled={loading} />}
              </Field>
            </div>
            <Field id="register-password" label="Senha" required hint="Mínimo de 8 caracteres, com letras e números.">
              {(a) => <PasswordInput {...a} autoComplete="new-password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} disabled={loading} />}
            </Field>
            <Field id="register-confirm" label="Repita a senha" required>
              {(a) => <PasswordInput {...a} autoComplete="new-password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} disabled={loading} />}
            </Field>
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-[#93C742] text-sm font-semibold text-slate-950 hover:bg-[#84B53A]">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {loading ? "Criando conta…" : "Criar minha conta"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-fsy-watermark text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      {/* Top Header */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/" className="fsy-action-link flex items-center gap-2.5 sm:gap-3 group">
          <div className="w-6 h-9 sm:w-7 sm:h-10 shrink-0 rounded-t-full rounded-b-lg bg-[#EFEFE7] dark:bg-slate-800 flex items-center justify-center p-0.5 border-2 border-slate-900/50 dark:border-slate-700 shadow-xs overflow-hidden">
            <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
          </div>
          <FsyFloatingLetters size="xs" className="hidden sm:inline-flex" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-black text-xs sm:text-sm tracking-tight block text-slate-900 dark:text-white">
                Sessão Ribeirão Preto 2
              </span>
              <span className="rounded-md bg-[#FFE48A] px-1.5 py-0.2 text-xs font-black uppercase text-amber-950 border border-amber-500/40">
                2027
              </span>
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold block">
              Edição 2027 • 05 a 10 de Fevereiro
            </span>
          </div>
        </Link>

        <ThemeToggle />
      </header>

      {/* Main Centered Login / Register Section */}
      <main className="flex-1 flex items-center justify-center py-8">
        <LoginFormContent />
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
        © 2027 FSY Sessão Ribeirão Preto 2 · {EVENT_THEME}
      </footer>
    </div>
  );
}
