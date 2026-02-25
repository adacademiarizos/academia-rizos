import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { sendBugReportEmail } from "@/lib/mail";

const ADMIN_BUG_EMAIL = "ramsesgonzalez20066@gmail.com";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
const MAX_IMAGES = 5;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const bugType = String(formData.get("bugType") ?? "") as "CONTENT" | "FUNCTIONALITY";

  if (!title || !description || !bugType) {
    return NextResponse.json({ ok: false, error: "Faltan campos requeridos" }, { status: 400 });
  }
  if (!["CONTENT", "FUNCTIONALITY"].includes(bugType)) {
    return NextResponse.json({ ok: false, error: "Tipo de bug inválido" }, { status: 400 });
  }

  // Upload images
  const imageUrls: string[] = [];
  const imageFiles = formData.getAll("images") as File[];

  for (const file of imageFiles.slice(0, MAX_IMAGES)) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: `Tipo de archivo no permitido: ${file.type}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Cada imagen debe ser menor a 5MB" },
        { status: 400 }
      );
    }

    try {
      const ext = file.type.split("/")[1] ?? "jpg";
      const key = `bug-reports/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadFile(key, buffer, file.type);
      imageUrls.push(url);
    } catch (e) {
      console.error("[bug-report] image upload failed", e);
      // Continue without this image
    }
  }

  // Save to DB
  const report = await db.bugReport.create({
    data: {
      userId: user.id,
      title,
      description,
      bugType,
      imageUrls,
    },
  });

  // Send email to admins if FUNCTIONALITY
  if (bugType === "FUNCTIONALITY") {
    const adminUsers = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true },
    });

    const adminEmails = [
      ...adminUsers.map((u) => u.email).filter(Boolean),
      ADMIN_BUG_EMAIL,
    ];

    // Deduplicate
    const uniqueEmails = [...new Set(adminEmails)];

    sendBugReportEmail({
      to: uniqueEmails,
      reporterName: user.name ?? "Usuario",
      reporterEmail: user.email,
      title,
      description,
      bugType,
      imageUrls,
    }).catch((e) => console.error("[bug-report] email send failed", e));
  }

  return NextResponse.json({ ok: true, data: { id: report.id } });
}
