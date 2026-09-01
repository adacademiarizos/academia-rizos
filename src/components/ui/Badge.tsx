import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "copper" | "success" | "warning" | "danger" | "neutral";

const toneStyles: Record<Tone, string> = {
  copper: "bg-ap-copper/15 text-ap-copper",
  success: "bg-emerald-500/15 text-emerald-400",
  warning: "bg-amber-500/15 text-amber-400",
  danger: "bg-red-500/15 text-red-400",
  neutral: "bg-white/10 text-white/70",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        toneStyles[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
