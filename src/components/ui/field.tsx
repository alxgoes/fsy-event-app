"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

interface FieldProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** Recebe os atributos de acessibilidade que ligam rótulo, dica e erro ao controle. */
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true; required?: boolean }) => React.ReactNode;
}

/** Rótulo, dica e mensagem de erro em pt-BR ligados ao controle por aria-describedby. */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
        {required && (
          <span className="ml-0.5 text-[#B42318] dark:text-[#FF8A7A]" aria-hidden="true">*</span>
        )}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-semibold leading-relaxed text-[#B42318] dark:text-[#FF8A7A]">{error}</p>
      )}
    </div>
  );
}

/** Campo de senha com botão de exibir/ocultar de 44 px e suporte a gerenciadores de senha. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-12", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-xl text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/20 dark:text-slate-300 dark:hover:text-white"
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
