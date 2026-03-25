import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { db } from "@/lib/db";

const PAGE_SIZES = [5, 10, 25, 50, 100] as const;

function toPage(value: string | null) {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return parsed;
}

function toLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "25", 10);
  if (PAGE_SIZES.includes(parsed as (typeof PAGE_SIZES)[number])) return parsed;
  return 25;
}

export async function GET(req: Request) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "";
  const page = toPage(searchParams.get("page"));
  const limit = toLimit(searchParams.get("limit"));

  const searchWhere: any = {};
  if (search) {
    searchWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  const where: any = { ...searchWhere };
  if (role) where.role = role;

  const [total, users, adminCount, staffCount, studentCount] = await db.$transaction([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
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
    }),
    db.user.count({ where: { ...searchWhere, role: "ADMIN" } }),
    db.user.count({ where: { ...searchWhere, role: "STAFF" } }),
    db.user.count({ where: { ...searchWhere, role: "STUDENT" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const roleCounts = { ADMIN: adminCount, STAFF: staffCount, STUDENT: studentCount };

  return NextResponse.json({
    ok: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    roleCounts,
  });
}
