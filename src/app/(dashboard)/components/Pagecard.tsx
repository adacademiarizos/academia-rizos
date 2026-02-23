import type { ReactNode } from "react";

export default function PageCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl">
      {children}
    </div>
  );
}
