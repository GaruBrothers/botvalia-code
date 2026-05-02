import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-gray-800 text-gray-50 hover:bg-gray-800/80": variant === "default",
          "border-transparent bg-gray-800/50 text-gray-300 hover:bg-gray-800/40": variant === "secondary",
          "border-transparent bg-red-900/40 text-red-400": variant === "destructive",
          "border-transparent bg-emerald-900/40 text-emerald-400": variant === "success",
          "border-transparent bg-amber-900/40 text-amber-500": variant === "warning",
          "text-gray-400 border-gray-700": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
