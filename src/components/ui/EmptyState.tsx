import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 px-6 py-16 text-center">
      {icon ? <div className="text-white/40">{icon}</div> : null}
      <p className="text-sm font-semibold text-white/80">{title}</p>
      {description ? <p className="max-w-sm text-sm text-white/50">{description}</p> : null}
      {action}
    </div>
  );
}
