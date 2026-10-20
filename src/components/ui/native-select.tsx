import * as React from "react"

import { cn } from "@/lib/utils"
import { FIELD_SELECT } from "@/components/ui/field-styles"

/** Select nativo com a identidade FSY. A lista de opções aberta é desenhada pelo sistema operacional. */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select ref={ref} data-slot="native-select" className={cn(FIELD_SELECT, className)} {...props} />
  )
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
