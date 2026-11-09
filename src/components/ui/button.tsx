import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#E91E63] text-white font-medium shadow-sm hover:bg-[#C2185B] active:scale-[0.98] transition-all",
        destructive:
          "bg-[#EF4444] text-white shadow-sm hover:bg-[#DC2626] active:scale-[0.98] transition-all",
        outline:
          "border border-border bg-transparent text-foreground shadow-sm hover:bg-secondary hover:text-foreground",
        secondary: "bg-secondary text-foreground border border-border/80 shadow-sm hover:bg-muted",
        ghost: "text-foreground hover:bg-secondary hover:text-foreground",
        link: "text-[#E91E63] underline-offset-4 hover:underline",
        rose: "bg-[#E91E63] text-white font-semibold shadow-sm hover:bg-[#C2185B] active:scale-[0.98] transition-all",
        glass: "bg-card border border-border text-foreground hover:bg-secondary transition-colors",
      },
      size: {
        default: "h-9 px-4 py-2 text-xs sm:text-sm",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-6 text-sm font-semibold",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
