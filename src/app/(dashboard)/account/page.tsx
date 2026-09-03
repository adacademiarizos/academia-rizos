import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { db } from "@/lib/db";
import { AccountDeletionPanel } from "./AccountDeletionPanel";
import { AccountProfilePanel } from "./AccountProfilePanel";
import { AccountPasswordPanel } from "./AccountPasswordPanel";
import { AccountNotificationsPanel } from "./AccountNotificationsPanel";

export const metadata = {
  title: "Mi cuenta | Apoteósicas",
  description: "Gestiona tus datos, tu contraseña y tus preferencias de privacidad",
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
      phone: true,
      image: true,
      role: true,
      password: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    redirect("/signin");
  }

  const { deleteToken } = await searchParams;

  const [coursesCount, certificatesCount] = await Promise.all([
    db.courseAccess.count({ where: { userId: user.id, revokedAt: null } }),
    db.certificate.count({ where: { userId: user.id, valid: true } }),
  ]);

  const roleLabel =
    user.role === "ADMIN" ? "Administradora" : user.role === "STAFF" ? "Equipo" : "Alumna";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Mi cuenta</h1>
        <p className="mt-1 text-sm text-white/60">
          Gestiona tus datos personales, tu acceso y las opciones de privacidad.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Perfil" value={roleLabel} />
        <SummaryTile label="Cursos con acceso" value={String(coursesCount)} />
        <SummaryTile
          label="Certificados"
          value={String(certificatesCount)}
          href={certificatesCount > 0 ? "/student/certificates" : undefined}
        />
      </div>

      <AccountProfilePanel
        initialName={user.name ?? ""}
        initialPhone={user.phone ?? ""}
        initialImage={user.image}
        email={user.email}
      />

      <AccountPasswordPanel hasPassword={Boolean(user.password)} />

      <AccountNotificationsPanel />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AccountDeletionPanel
          userName={user.name}
          userEmail={user.email}
          role={user.role}
          hasPassword={Boolean(user.password)}
          initialDeleteToken={deleteToken ?? null}
        />

        <aside className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-3xl">
          <h2 className="text-base font-semibold text-white">Qué conservamos</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            Si eliminas tu cuenta, anonimizamos tu perfil, tus reservas, mensajes,
            comentarios y reportes asociados. Algunos registros de pago pueden
            mantenerse por obligaciones fiscales o contables, pero desvinculados de
            tu identidad.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
            <p className="font-semibold text-white">Método de confirmación</p>
            <p className="mt-2">
              {user.password
                ? "Esta cuenta confirma el borrado con tu contraseña actual."
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

function SummaryTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="text-xl font-semibold text-white">{value}</div>
      <p className="mt-1 text-xs uppercase tracking-wider text-white/40">{label}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition hover:border-ap-copper/40 hover:bg-white/10"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">{content}</div>
  );
}
