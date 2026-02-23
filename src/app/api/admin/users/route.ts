import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "";

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (role) where.role = role;

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          appointments: true,
          courseAccess: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, data: users });
}
