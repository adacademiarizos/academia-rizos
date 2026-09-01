import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PREVIEW_USER = {
  email: "preview.student@elizabeth.com",
  name: "Preview Student",
  password: "preview123",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureStyle(courseId: string, name: string, order: number, description: string) {
  const slug = slugify(name);

  return prisma.moduleStyle.upsert({
    where: { courseId_slug: { courseId, slug } },
    update: {
      name,
      order,
      description,
      isActive: true,
    },
    create: {
      courseId,
      name,
      slug,
      order,
      description,
      isActive: true,
    },
  });
}

async function ensureLesson(
  styleId: string,
  order: number,
  title: string,
  description: string,
  transcript: string
) {
  const existing = await prisma.lesson.findFirst({
    where: { styleId, title },
  });

  if (existing) {
    return prisma.lesson.update({
      where: { id: existing.id },
      data: {
        order,
        description,
        transcript,
      },
    });
  }

  // Lessons are course-scoped as well as style-scoped, so the course is read
  // off the style instead of being threaded through every caller.
  const style = await prisma.moduleStyle.findUnique({
    where: { id: styleId },
    select: { courseId: true },
  });

  if (!style) {
    throw new Error(`Cannot create lesson "${title}": style ${styleId} not found`);
  }

  return prisma.lesson.create({
    data: {
      courseId: style.courseId,
      styleId,
      order,
      title,
      description,
      transcript,
    },
  });
}

async function main() {
  const course = await prisma.course.findFirst({
    where: { title: { contains: "Curly Girl" } },
    orderBy: { createdAt: "asc" },
    include: {
      modules: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!course) {
    throw new Error("No local courses found. Run `npm run seed` first.");
  }

  const hashedPassword = await bcrypt.hash(PREVIEW_USER.password, 10);
  const previewUser = await prisma.user.upsert({
    where: { email: PREVIEW_USER.email },
    update: {
      name: PREVIEW_USER.name,
      role: "STUDENT",
      password: hashedPassword,
    },
    create: {
      email: PREVIEW_USER.email,
      name: PREVIEW_USER.name,
      role: "STUDENT",
      password: hashedPassword,
    },
  });

  await prisma.courseAccess.upsert({
    where: { userId_courseId: { userId: previewUser.id, courseId: course.id } },
    update: { accessUntil: null },
    create: { userId: previewUser.id, courseId: course.id, accessUntil: null },
  });

  const [firstModule, secondModule] = course.modules;

  if (!firstModule) {
    throw new Error("Preview course has no modules.");
  }

  const firstStyles = await Promise.all([
    ensureStyle(course.id, "Rizos", 0, "Lecciones enfocadas en cabello rizado."),
    ensureStyle(course.id, "Lacio", 1, "Comparativas y adaptaciones para cabello lacio."),
    ensureStyle(course.id, "Ondulado", 2, "Variantes y tecnica para cabello ondulado."),
  ]);

  await ensureLesson(
    firstStyles[0].id,
    0,
    "Diagnostico de rizos tipo 2C-3A",
    "Como observar patron, densidad y frizz en alumnas con rizos suaves.",
    "Preview lesson for the Rizos style."
  );
  await ensureLesson(
    firstStyles[0].id,
    1,
    "Rutina inicial para definicion",
    "Secuencia corta para preparar la fibra y definir sin apelmazar.",
    "Preview lesson showing multiple lessons under one style."
  );
  await ensureLesson(
    firstStyles[1].id,
    0,
    "Adaptando el contenido a cabello lacio",
    "Ejemplo visual de como un estilo puede agrupar una variante distinta del mismo tema.",
    "Preview lesson for the Lacio style."
  );
  await ensureLesson(
    firstStyles[2].id,
    0,
    "Ondas y transicion de tecnica",
    "Caso de uso para alumnas con ondas que necesitan menos producto.",
    "Preview lesson for the Ondulado style."
  );

  if (secondModule) {
    const secondStyles = await Promise.all([
      ensureStyle(course.id, "Afro", 3, "Contenido agrupado para alta densidad y coil patterns."),
      ensureStyle(course.id, "Transicion", 4, "Lecciones para mezcla de texturas y cambio de rutina."),
    ]);

    await ensureLesson(
      secondStyles[0].id,
      0,
      "Analisis de alta densidad",
      "Observaciones clave para trabajar volumen, contraccion y seccionado.",
      "Preview lesson for the Afro style."
    );
    await ensureLesson(
      secondStyles[1].id,
      0,
      "Rutina para cabello en transicion",
      "Ejemplo de estructura cuando el modulo mezcla estilos especializados.",
      "Preview lesson for the Transicion style."
    );
  }

  await prisma.moduleProgress.upsert({
    where: {
      userId_moduleId: {
        userId: previewUser.id,
        moduleId: firstModule.id,
      },
    },
    update: {
      completed: true,
      completedAt: new Date(),
    },
    create: {
      userId: previewUser.id,
      moduleId: firstModule.id,
      completed: true,
      completedAt: new Date(),
    },
  });

  const refreshedCourse = await prisma.course.findUnique({
    where: { id: course.id },
    include: {
      modules: { orderBy: { order: "asc" } },
      styles: {
        orderBy: { order: "asc" },
        include: { _count: { select: { lessons: true } } },
      },
    },
  });

  console.log("Preview environment ready");
  console.log(`User: ${PREVIEW_USER.email}`);
  console.log(`Password: ${PREVIEW_USER.password}`);
  console.log(`Course: ${course.title}`);
  console.log(`Course URL: /learn/${course.id}`);
  console.log(`First module URL: /learn/${course.id}/modules/${firstModule.id}`);

  for (const courseModule of refreshedCourse?.modules ?? []) {
    console.log(`Module ${courseModule.order}: ${courseModule.title}`);
  }
  for (const style of refreshedCourse?.styles ?? []) {
    console.log(`Style ${style.order}: ${style.name} (${style._count.lessons} lessons)`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
