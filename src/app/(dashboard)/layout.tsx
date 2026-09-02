import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import DashboardShell from "./components/DashboardShell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Signed-in users who never confirmed their own name are sent to onboarding
  // first: OAuth hands us whatever name the provider had, and that name is what
  // gets printed on their certificates. Signed-out visitors fall through so the
  // individual pages keep owning their own auth redirects.
  const session = await getServerSession(authOptions);

  if (session?.user?.email && !session.invalidated) {
    const user = await db.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { profileCompletedAt: true },
    });

    if (user && !user.profileCompletedAt) {
      redirect("/onboarding");
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}
