import { NextResponse } from "next/server";
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options';
import { db } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { NotificationEventService } from "@/server/services/notification-event-service";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
const MAX_IMAGES = 5;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
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

  // Notifications are queued after persistence and never alter the outcome of
  // the report. Functional incidents additionally receive outbox email.
  await NotificationEventService.bugReportCreated({
    reportId: report.id,
    reporter: user,
    reporterName: user.name ?? "Usuario",
    title,
    bugType,
  });

  return NextResponse.json({ ok: true, data: { id: report.id } });
}
