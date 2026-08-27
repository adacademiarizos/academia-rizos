import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "dark" | "light";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  children: ReactNode;
}

const toneStyles: Record<Tone, string> = {
  dark: "border border-white/10 bg-white/5 text-white backdrop-blur-3xl",
  light: "border border-black/10 bg-white/70 text-zinc-900 backdrop-blur-md",
};

export function Card({ tone = "dark", className, children, ...props }: CardProps) {
  return (
    <div className={cn("rounded-3xl p-6 shadow-sm", toneStyles[tone], className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
}
