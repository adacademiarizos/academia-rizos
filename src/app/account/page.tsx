import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { AccountDeletionPanel } from "./AccountDeletionPanel";

export const metadata = {
  title: "Mi cuenta | Apoteosicas",
  description: "Gestiona tu cuenta y tus preferencias de privacidad",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ deleteToken?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.invalidated) {
    redirect("/signin?callbackUrl=/account");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      password: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    redirect("/signin");
  }

  const { deleteToken } = await searchParams;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Mi cuenta</h1>
        <p className="mt-1 text-sm text-white/60">
          Administra tus datos personales y las opciones de privacidad.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AccountDeletionPanel
          userName={user.name}
          userEmail={user.email}
          role={user.role}
          hasPassword={Boolean(user.password)}
          initialDeleteToken={deleteToken ?? null}
        />

        <aside className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl">
          <h2 className="text-base font-semibold text-white">Que conservamos</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Si eliminas tu cuenta, anonimizamos tu perfil, tus reservas, mensajes,
            comentarios y reportes asociados. Algunos registros de pago pueden
            mantenerse por obligaciones fiscales o contables, pero desvinculados de
            tu identidad.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
            <p className="font-semibold text-white">Metodo de confirmacion</p>
            <p className="mt-2">
              {user.password
                ? "Esta cuenta confirma el borrado con tu contrasena actual."
                : "Esta cuenta confirma el borrado con un enlace enviado a tu email."}
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-[#b16e34]/35 bg-[#b16e34]/10 p-4 text-sm text-[#f6dfc2]">
            <p className="font-semibold">Email actual</p>
            <p className="mt-1 break-all text-[#f6dfc2]/90">{user.email}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
