import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-gray-800 text-gray-50 shadow hover:bg-gray-800/90": variant === 'default',
            "bg-gray-800/50 text-gray-200 hover:bg-gray-800/80": variant === 'secondary',
            "hover:bg-gray-800/50 text-gray-300 hover:text-gray-50": variant === 'ghost',
            "bg-red-900 text-gray-50 hover:bg-red-900/90": variant === 'destructive',
            "border border-gray-700 bg-transparent shadow-sm hover:bg-gray-800 text-gray-300": variant === 'outline',
            "h-9 px-4 py-2": size === 'default',
            "h-8 rounded-md px-3 text-xs": size === 'sm',
            "h-10 rounded-md px-8": size === 'lg',
            "h-9 w-9": size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
