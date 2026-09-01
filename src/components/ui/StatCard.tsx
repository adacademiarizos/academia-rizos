import type { ReactNode } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { value: string; positive?: boolean };
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, trend, icon }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/60">{label}</span>
        {icon ? <span className="text-ap-copper">{icon}</span> : null}
      </div>
      <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
      {(hint || trend) && (
        <div className="flex items-center gap-2 text-xs">
          {trend ? (
            <span className={cn("font-semibold", trend.positive ? "text-emerald-400" : "text-red-400")}>
              {trend.value}
            </span>
          ) : null}
          {hint ? <span className="text-white/50">{hint}</span> : null}
        </div>
      )}
    </Card>
  );
}
