"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Field, PasswordInput } from "@/components/ui/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { passwordProblem } from "@/lib/auth/password-policy";

type Stage = "checking" | "ready" | "expired" | "saving" | "done";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("erro") === "link") {
        setStage("expired");
        return;
      }
      // Link padrão do Supabase: tokens chegam no fragmento (#) e nunca vão ao servidor.
      const hash = new URLSearchParams(url.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (hash.get("error_code")) {
        window.history.replaceState(null, "", url.pathname);
        if (active) setStage("expired");
        return;
      }
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, "", url.pathname);
        if (!active) return;
        setStage(sessionError ? "expired" : "ready");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (active) setStage(data.session ? "ready" : "expired");
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("As duas senhas precisam ser iguais.");
    setError(null);
    setStage("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setStage("ready");
      setError(
        updateError.code === "same_password"
          ? "A nova senha precisa ser diferente da anterior."
          : updateError.code === "weak_password"
            ? "Senha fraca demais para a política do portal. Use mais caracteres, letras e números."
            : "Não foi possível salvar a nova senha. Peça um novo link e tente de novo."
      );
      return;
    }
    // Encerra a sessão de recuperação: a pessoa entra de novo com a senha nova.
    await supabase.auth.signOut();
    setStage("done");
    setTimeout(() => router.replace("/login?senha=redefinida"), 1500);
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#FAF8F5] px-4 py-10 dark:bg-slate-950">
      <section
        aria-labelledby="reset-title"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900 sm:p-8"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E6F4F9] text-[#007DA5] dark:bg-[#01B6D1]/15 dark:text-[#7DE3F4]">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 id="reset-title" className="font-heading text-xl font-bold text-slate-900 dark:text-white">
              Criar nova senha
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Senha do Portal FSY. Não altera a senha da sua conta Google.</p>
          </div>
        </div>

        {stage === "checking" && (
          <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Validando o link…
          </p>
        )}

        {stage === "expired" && (
          <div className="space-y-4" role="alert">
            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-100">
              Este link de redefinição é inválido, já foi usado ou expirou. Peça um novo na tela de entrada.
            </p>
            <Link href="/login?modo=recuperar" className={cn(buttonVariants(), "h-11 w-full rounded-xl text-sm font-semibold")}>
              Pedir novo link
            </Link>
          </div>
        )}

        {(stage === "ready" || stage === "saving") && (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <input type="text" name="username" autoComplete="username" className="sr-only" tabIndex={-1} aria-hidden="true" readOnly value="" />
            <Field id="new-password" label="Nova senha" required hint="Mínimo de 8 caracteres, com letras e números." error={error && !error.includes("iguais") ? error : null}>
              {(a) => (
                <PasswordInput {...a} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={stage === "saving"} />
              )}
            </Field>
            <Field id="confirm-password" label="Repita a nova senha" required error={error && error.includes("iguais") ? error : null}>
              {(a) => (
                <PasswordInput {...a} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={stage === "saving"} />
              )}
            </Field>
            <Button type="submit" disabled={stage === "saving"} className="h-11 w-full rounded-xl text-sm font-semibold">
              {stage === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {stage === "saving" ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        )}

        {stage === "done" && (
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2F6B1F] dark:text-[#B5E07A]" role="status">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Senha alterada. Levando você para a entrada…
          </p>
        )}

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-[#007DA5] underline-offset-4 hover:underline dark:text-[#7DE3F4]">
            Voltar para a entrada
          </Link>
        </p>
      </section>
    </main>
  );
}
