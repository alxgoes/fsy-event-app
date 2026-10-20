"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({
  className,
  checked = false,
  onCheckedChange,
  id,
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "peer relative inline-flex size-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-slate-500 dark:border-slate-400 transition-colors cursor-pointer select-none overflow-hidden focus-within:ring-4 focus-within:ring-[#007DA5]/25",
        checked
          ? "bg-[#007DA5] border-[#007DA5] text-white dark:bg-[#01B6D1] dark:border-[#01B6D1] dark:text-slate-950"
          : "bg-white dark:bg-slate-800",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="sr-only"
        {...props}
      />
      {checked && <Check className="h-3.5 w-3.5 stroke-[3.5]" aria-hidden="true" />}
    </label>
  );
}
