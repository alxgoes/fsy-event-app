import * as React from "react"

import { cn } from "@/lib/utils"
import { FIELD_TEXTAREA } from "@/components/ui/field-styles"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn("flex field-sizing-content", FIELD_TEXTAREA, className)}
      {...props}
    />
  )
}

export { Textarea }
