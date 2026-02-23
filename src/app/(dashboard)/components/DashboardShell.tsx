import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ap-bg text-white">
      <Sidebar />

      <div className="md:pl-[280px]">
        <main className="px-5 py-6 pt-16 md:pt-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
