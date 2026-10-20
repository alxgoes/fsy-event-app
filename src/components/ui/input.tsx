import * as React from "react"
import { cn } from "@/lib/utils"
import { FIELD_INPUT } from "@/components/ui/field-styles"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        data-slot="input"
        className={cn(
          FIELD_INPUT,
          "file:mr-3 file:inline-flex file:h-8 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-semibold file:text-slate-800 dark:file:bg-slate-800 dark:file:text-slate-100",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
