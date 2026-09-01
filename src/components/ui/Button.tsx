"use client";

import Link from "next/link";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ap-copper/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ap-bg";

const variants: Record<Variant, string> = {
  primary: "bg-ap-copper text-white shadow-lg shadow-black/20 hover:opacity-90",
  secondary: "border border-white/15 bg-white/10 text-white backdrop-blur-md hover:bg-white/15",
  outline: "border border-ap-copper/50 text-ap-copper hover:bg-ap-copper/10",
  ghost: "text-white/80 hover:bg-white/10 hover:text-white",
  danger: "bg-red-600/90 text-white hover:bg-red-600",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };

type ButtonAsLink = CommonProps & {
  href: string;
  target?: string;
  rel?: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", isLoading, className, children, ...props },
  ref
) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if ("href" in props && props.href) {
    const { href, target, rel } = props;
    return (
      <Link href={href} target={target} rel={rel} className={classes}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button ref={ref} className={classes} disabled={isLoading || buttonProps.disabled} {...buttonProps}>
      {isLoading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : null}
      {children}
    </button>
  );
});
