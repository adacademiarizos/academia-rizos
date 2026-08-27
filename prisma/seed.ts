/**
 * Seed data for Elizabeth Rizos Platform - Academy + Services
 * Creates demo users, courses, services, appointments, notifications, FAQ, etc.
 * See docs/DEMO_DATA.md for details on all demo data.
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const __dirname = dirname(fileURLToPath(import.meta.url))

/* ─────────────────────────────────────────────
 *  DEMO USERS SEED
 * ───────────────────────────────────────────── */

async function seedDemoUsers() {
  console.log('\n👥 Seeding demo users...')

  const users = [
    { email: 'admin@elizabeth.com', name: 'Elizabeth Admin', role: 'ADMIN' as const, password: 'admin123' },
    { email: 'staff@elizabeth.com', name: 'María Staff', role: 'STAFF' as const, password: 'staff123' },
    { email: 'student@elizabeth.com', name: 'Ana Estudiante', role: 'STUDENT' as const, password: 'student123' },
    { email: 'student2@elizabeth.com', name: 'Laura Estudiante', role: 'STUDENT' as const, password: 'student123' },
  ]

  const created: Record<string, string> = {}

  for (const u of users) {
    const hashedPassword = await bcrypt.hash(u.password, 10)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password: hashedPassword },
      create: { email: u.email, name: u.name, role: u.role, password: hashedPassword },
    })
    created[u.email] = user.id
    console.log(`  ✅ User: ${u.name} (${u.role})`)
  }

  // Create staff profile for María
  const staffId = created['staff@elizabeth.com']
  if (staffId) {
    await prisma.staffProfile.upsert({
      where: { userId: staffId },
      update: {},
      create: {
        userId: staffId,
        bio: 'Especialista en rizos con 5 años de experiencia',
        photoUrl: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400&h=400&fit=crop',
      },
    })
    console.log('  ✅ Staff profile: María Staff')
  }

  return created
}

/* ─────────────────────────────────────────────
 *  SERVICES & CATEGORIES SEED
 * ───────────────────────────────────────────── */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function seedGeneralStylesAndLessons(courseIds: string[]) {
  console.log('\nðŸ“š Seeding module styles & lessons...')

  const modules = await prisma.module.findMany({
    where: { courseId: { in: courseIds } },
    orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
    select: {
      id: true,
      title: true,
      description: true,
      videoUrl: true,
      videoFileUrl: true,
      transcript: true,
    },
  })

  for (const courseModule of modules) {
    const style = await prisma.moduleStyle.upsert({
      where: { moduleId_slug: { moduleId: courseModule.id, slug: 'general' } },
      update: {
        name: 'General',
        order: 0,
        isActive: true,
      },
      create: {
        moduleId: courseModule.id,
        order: 0,
        name: 'General',
        slug: 'general',
        description: 'Contenido base de la seccion.',
        isActive: true,
      },
    })

    const existingLessons = await prisma.lesson.count({ where: { moduleId: courseModule.id } })
    if (existingLessons === 0) {
      await prisma.lesson.create({
        data: {
          moduleId: courseModule.id,
          styleId: style.id,
          order: 0,
          title: courseModule.title,
          description: courseModule.description,
          videoUrl: courseModule.videoUrl,
          videoFileUrl: courseModule.videoFileUrl,
          transcript: courseModule.transcript,
        },
      })
    }
  }

  console.log(`  âœ… ${modules.length} module styles checked`)
}

type RawVariant = {
  name: string;
  time: number | string;
  typeOfPrice: string;
  price: number;
};

type RawService = {
  name: string;
  typeOfService: string;
  time: number | null;
  typeOfPrice: string;
  price: number | null;
  variants: RawVariant[];
  category: string;
  description: string;
  images: string[];
};

async function seedServicesAndCategories() {
  console.log("\n🏷️  Seeding service categories & services...");

  // 1. Categories
  const categoryNames = [
    "Peinados",
    "Pack Cabello ondulado densidad media-baja",
    "Pack Cabello afro alta densidad",
    "Pack Cabello rizado densidad media/alta",
    "Pack Infantil",
  ];

  const categoryMap = new Map<string, string>(); // name → id

  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i];
    const cat = await prisma.serviceCategory.upsert({
      where: { slug: slugify(name) },
      update: { name, order: i },
      create: { name, slug: slugify(name), order: i, isActive: true },
    });
    categoryMap.set(name, cat.id);
    console.log(`  ✅ Category: ${name}`);
  }

  // 2. Load services JSON (already in prisma/data/)
  const rawJson = readFileSync(join(__dirname, "data", "servicios.json"), "utf-8");
  const serviciosData: { servicios: RawService[] } = JSON.parse(rawJson);

  // Deduplicate by name+category
  const seen = new Set<string>();
  const uniqueServices: RawService[] = [];
  for (const s of serviciosData.servicios) {
    const key = `${s.name}::${s.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueServices.push(s);
  }

  // 3. Find all staff users to create prices
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ["STAFF", "ADMIN"] } },
    select: { id: true, name: true },
  });

  if (staffUsers.length === 0) {
    console.log("  ⚠️  No staff/admin users found — prices won't be created. Add staff first.");
  }

  // 4. Delete existing services and variants to avoid conflicts on re-seed
  try {
    await prisma.variantStaffPrice.deleteMany({});
    await prisma.serviceVariant.deleteMany({});
    await prisma.serviceStaffPrice.deleteMany({});
    await prisma.service.deleteMany({});
    console.log("  🗑️  Cleared existing services data");
  } catch (e) {
    console.warn('  ⚠️  Could not clear services (existing references detected) — skipping delete:', (e as any)?.message ?? e)
  }

  // 5. Create each service
  let serviceOrder = 0;
  for (const raw of uniqueServices) {
    const categoryId = categoryMap.get(raw.category) ?? null;
    const hasVariants = raw.variants && raw.variants.length > 0;

    // Determine billing rule
    let billingRule: "FULL" | "DEPOSIT" | "AUTHORIZE" = "FULL";
    if (raw.typeOfPrice === "variable" && !hasVariants) {
      billingRule = "AUTHORIZE"; // variable price, no defined variants → contact for price
    }

    const service = await prisma.service.create({
      data: {
        name: raw.name,
        description: raw.description,
        durationMin: raw.time != null ? Number(raw.time) : null,
        billingRule,
        depositPct: null,
        isActive: true,
        imageUrls: raw.images ?? [],
        typeOfService: raw.typeOfService,
        order: serviceOrder++,
        categoryId,
      },
    });

    // Create ServiceStaffPrice for fixed-price services without variants
    if (raw.typeOfPrice === "fijo" && raw.price != null && !hasVariants) {
      for (const staff of staffUsers) {
        await prisma.serviceStaffPrice.create({
          data: {
            serviceId: service.id,
            staffId: staff.id,
            priceCents: Math.round(raw.price * 100),
            currency: "EUR",
          },
        });
      }
    }

    // Create variants
    if (hasVariants) {
      for (let vi = 0; vi < raw.variants.length; vi++) {
        const rv = raw.variants[vi];
        const variant = await prisma.serviceVariant.create({
          data: {
            serviceId: service.id,
            name: rv.name,
            durationMin: Number(rv.time),
            order: vi,
            isActive: true,
          },
        });

        // Create VariantStaffPrice for each staff
        for (const staff of staffUsers) {
          await prisma.variantStaffPrice.create({
            data: {
              variantId: variant.id,
              staffId: staff.id,
              priceCents: Math.round(rv.price * 100),
              currency: "EUR",
            },
          });
        }
      }
    }

    console.log(`  ✅ Service: ${raw.name}${hasVariants ? ` (${raw.variants.length} variants)` : ""}`);
  }

  console.log(`\n✨ Services seeding completed! ${uniqueServices.length} services, ${categoryNames.length} categories.`);
}

/* ─────────────────────────────────────────────
 *  ACADEMY SEED (original)
 * ───────────────────────────────────────────── */

async function main() {
  // Seed demo users first
  const userIds = await seedDemoUsers()

  // Seed services & categories
  await seedServicesAndCategories();

  console.log('\n🌱 Seeding database with academy content...')

  // Clean up existing data (optional)
  // await prisma.submission.deleteMany({})
  // await prisma.certificate.deleteMany({})
  // await prisma.test.deleteMany({})
  // await prisma.module.deleteMany({})
  // await prisma.course.deleteMany({})

  // Create Course 1: Curly Girl Method Basics
  const course1 = await prisma.course.create({
    data: {
      title: 'El Método Curly Girl: Fundamentos',
      description:
        'Aprende todo sobre el Método Curly Girl (CGM). Descubre cómo cuidar, definir y potenciar tus rizos naturales con técnicas probadas y productos recomendados.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=450&fit=crop',
      trailerUrl:
        'https://cdn.pixabay.com/video/2022/09/17/131612-750753082_large.mp4',
      priceCents: 2999, // $29.99 USD
      currency: 'USD',
      rentalDays: null, // Lifetime access
      certificateSlogan: 'Fundamentos del método Curly Girl para el cuidado de rizos',
      isActive: true,

      // Create modules
      modules: {
        create: [
          {
            order: 1,
            title: '¿Qué es realmente el Método Curly Girl?',
            description:
              'Introducción a los principios fundamentales del CGM y por qué funciona para rizos naturales.',
            videoUrl: 'https://cdn.pixabay.com/video/2022/09/17/131611-750753079_large.mp4',
            transcript:
              'En este módulo aprendemos que el Método Curly Girl es un protocolo de cuidado capilar específicamente diseñado para pelos rizados...',
          },
          {
            order: 2,
            title: 'Análisis de tu tipo de rizo',
            description:
              'Descubre cómo identificar tu tipo de rizo (patron, porosidad, densidad) para elegir los mejores productos.',
            videoUrl: 'https://cdn.pixabay.com/video/2022/09/17/131613-750753086_large.mp4',
            transcript:
              'Cada rizo es único. Entender tu tipo de rizo es el primer paso para un rutina efectiva...',
          },
          {
            order: 3,
            title: 'Ingredientes a evitar y buscar',
            description:
              'Guía completa de ingredientes: cuáles daña tus rizos y cuáles los potencian.',
            videoUrl: 'https://cdn.pixabay.com/video/2022/09/17/131603-750753064_large.mp4',
            transcript:
              'Los productos incorrectos pueden arruinar tus rizos. Aprende a leer etiquetas...',
          },
          {
            order: 4,
            title: 'Rutina básica: Lavado y acondicionamiento',
            description:
              'Paso a paso de cómo lavar y acondicionar tus rizos correctamente.',
            videoUrl: 'https://cdn.pixabay.com/video/2022/09/17/131607-750753070_large.mp4',
            transcript:
              'La técnica de lavado es crucial. No se trata solo de champú, sino de cómo lo aplicamos...',
          },
          {
            order: 5,
            title: 'Creming your waves: Técnica de definición',
            description:
              'Aprende la técnica de "creaming" para máxima definición de rizos.',
            videoUrl: 'https://cdn.pixabay.com/video/2020/07/02/43633-436237650_large.mp4',
            transcript:
              'El creaming es una técnica que permite crear rizos más definidos y duraderos...',
          },
        ],
      },

      // Create test for course
      test: {
        create: {
          schemaJson: {
            questions: [
              {
                id: 'q1',
                type: 'multipleChoice',
                text: '¿Cuál es el objetivo principal del Método Curly Girl?',
                options: [
                  { label: 'Alisar el cabello', value: 'a' },
                  { label: 'Potenciar los rizos naturales del cabello', value: 'b' },
                  { label: 'Crear rizos artificiales', value: 'c' },
                  { label: 'Teñir el cabello', value: 'd' },
                ],
                correctAnswer: 'b',
              },
              {
                id: 'q2',
                type: 'multipleChoice',
                text: '¿Cuál es un ingrediente que se debe EVITAR según el método?',
                options: [
                  { label: 'Sílicones', value: 'a' },
                  { label: 'Agua', value: 'b' },
                  { label: 'Acondicionador', value: 'c' },
                  { label: 'Aceites naturales', value: 'd' },
                ],
                correctAnswer: 'a',
              },
              {
                id: 'q3',
                type: 'text',
                text: 'Describe brevemente los pasos principales de una rutina básica CGM',
                required: true,
              },
              {
                id: 'q4',
                type: 'fileUpload',
                text: 'Sube una foto de tus rizos después de aplicar la rutina básica (evidencia de aprendizaje)',
                required: true,
              },
            ],
            passingScore: 70,
            maxAttempts: 3,
          },
        },
      },

      // Create resources
      resources: {
        create: [
          {
            type: 'PDF',
            fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            fileName: 'Guia-Nutrientes-CGM.pdf',
          },
          {
            type: 'IMAGE',
            fileUrl: 'https://images.unsplash.com/photo-1595475884562-073c30d45670?w=800&h=600&fit=crop',
            fileName: 'Clasificacion-Tipos-Rizo.jpg',
          },
        ],
      },
    },
  })

  console.log(`✅ Course 1 created: ${course1.title}`)

  // Create Course 2: Nutrition for Healthy Curls
  const course2 = await prisma.course.create({
    data: {
      title: 'Nutrición para Rizos Saludables',
      description:
        'Complementa tu rutina externa con nutrición interna. Aprende qué comer para tener rizos más fuertes, brillantes y elásticos desde adentro.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=800&h=450&fit=crop',
      trailerUrl:
        'https://cdn.pixabay.com/video/2021/08/01/83533-584851222_large.mp4',
      priceCents: 1999, // $19.99 USD - cheaper for shorter course
      currency: 'USD',
      rentalDays: 30, // 30-day rental access
      certificateSlogan: 'Nutrición consciente para rizos más fuertes y saludables',
      isActive: true,

      modules: {
        create: [
          {
            order: 1,
            title: 'La conexión entre nutrición y salud capilar',
            description:
              'Descubre por qué la nutrición interna es crucial para rizos hermosos.',
            videoUrl: 'https://cdn.pixabay.com/video/2020/04/27/37325-413555862_large.mp4',
            transcript: 'El cabello es un reflejo de nuestra salud interna...',
          },
          {
            order: 2,
            title: 'Vitaminas y minerales esenciales',
            description:
              'Cuáles son las vitaminas y minerales que necesitan tus rizos.',
            videoUrl: 'https://videos.pexels.com/video-files/3997178/3997178-uhd_1440_2732_25fps.mp4',
            transcript:
              'Hierro, zinc, biotina, vitamina B12... aprende qué hace cada uno...',
          },
          {
            order: 3,
            title: 'Plan de alimentación pro-rizos',
            description:
              'Crea tu propio plan de comidas para nutrición óptima del cabello.',
            videoUrl: 'https://videos.pexels.com/video-files/3997181/3997181-uhd_1440_2732_25fps.mp4',
            transcript: 'Ejemplos de desayunos, almuerzos y cenas nutritivas...',
          },
        ],
      },

      test: {
        create: {
          schemaJson: {
            questions: [
              {
                id: 'q1',
                type: 'multipleChoice',
                text: '¿Cuál de estos minerales es crítico para la salud del cabello?',
                options: [
                  { label: 'Hierro', value: 'a' },
                  { label: 'Cobre', value: 'b' },
                  { label: 'Zinc', value: 'c' },
                  { label: 'Todos los anteriores', value: 'd' },
                ],
                correctAnswer: 'd',
              },
              {
                id: 'q2',
                type: 'text',
                text: 'Menciona 5 alimentos que deberías incluir regularmente en tu dieta para rizos saludables',
                required: true,
              },
            ],
            passingScore: 60,
            maxAttempts: 2,
          },
        },
      },

      resources: {
        create: [
          {
            type: 'PDF',
            fileUrl:
              'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            fileName: 'Alimentos-Por-Nutriente.pdf',
          },
        ],
      },
    },
  })

  console.log(`✅ Course 2 created: ${course2.title}`)

  // Create Course 3: Advanced Curly Styling
  const course3 = await prisma.course.create({
    data: {
      title: 'Técnicas Avanzadas de Styling para Rizos',
      description:
        'Lleva tu juego de rizos al siguiente nivel con técnicas profesionales. Aprende plopping, praying hands, microus y más para conseguir definición perfecta.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&h=450&fit=crop',
      trailerUrl:
        'https://cdn.pixabay.com/video/2022/05/09/116433-708008197_large.mp4',
      priceCents: 3999, // $39.99 USD - premium course
      currency: 'USD',
      rentalDays: null, // Lifetime
      certificateSlogan: 'Técnicas avanzadas de styling y definición de rizos',
      isActive: true,

      modules: {
        create: [
          {
            order: 1,
            title: 'Herramientas esenciales para formar rizos',
            description:
              'Qué herramientas necesitas y cómo usarlas correctamente.',
            videoUrl: 'https://videos.pexels.com/video-files/7754398/7754398-hd_1920_1080_30fps.mp4',
            transcript: 'Difusor, plopping towel, difusor de secador...',
          },
          {
            order: 2,
            title: 'Técnica del Plopping - Paso a paso',
            description:
              'Domina la técnica de plopping para moldear tus rizos.',
            videoUrl: 'https://videos.pexels.com/video-files/7440200/7440200-uhd_1440_2732_25fps.mp4',
            transcript: 'El plopping es clave para distribuir productos...',
          },
          {
            order: 3,
            title: 'Praying Hands y Microus: Técnicas de aplicación',
            description:
              'Aprende dos métodos diferentes para aplicar productos.',
            videoUrl: 'https://videos.pexels.com/video-files/7383845/7383845-uhd_1440_2560_24fps.mp4',
            transcript:
              'Cada técnica tiene sus ventajas según tu tipo de rizo...',
          },
          {
            order: 4,
            title: 'Secado y afinamiento (Drying & Diffusing)',
            description:
              'Técnicas profesionales para secar sin encrespar.',
            videoUrl: 'https://videos.pexels.com/video-files/7754429/7754429-hd_1920_1080_30fps.mp4',
            transcript: 'El difusor es tu mejor amigo para rizos...',
          },
          {
            order: 5,
            title: 'Troubleshooting: Soluciona problemas comunes',
            description:
              'Qué hacer cuando algo no sale bien en tu rutina.',
            videoUrl: 'https://videos.pexels.com/video-files/8999390/8999390-uhd_1440_2560_25fps.mp4',
            transcript: 'Encrespamiento, frizz, rizos apachurrados...',
          },
        ],
      },

      test: {
        create: {
          schemaJson: {
            questions: [
              {
                id: 'q1',
                type: 'text',
                text: 'Explica en detalle la técnica de plopping y por qué es importante',
                required: true,
              },
              {
                id: 'q2',
                type: 'multipleChoice',
                text: '¿Cuál es la temperatura recomendada para secar con difusor?',
                options: [
                  { label: 'Lo más caliente posible', value: 'a' },
                  { label: 'Temperatura media a baja', value: 'b' },
                  { label: 'Aire frío únicamente', value: 'c' },
                  { label: 'Depende del tipo de rizo', value: 'd' },
                ],
                correctAnswer: 'd',
              },
              {
                id: 'q3',
                type: 'fileUpload',
                text: 'Sube un video o foto de ti aplicando una de las técnicas aprendidas',
                required: true,
              },
            ],
            passingScore: 75,
            maxAttempts: 3,
          },
        },
      },

      resources: {
        create: [
          {
            type: 'PDF',
            fileUrl:
              'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            fileName: 'Guia-Tecnicas-Avanzadas.pdf',
          },
          {
            type: 'IMAGE',
            fileUrl:
              'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=800&h=600&fit=crop',
            fileName: 'Posiciones-Manos-Tecnicas.jpg',
          },
        ],
      },
    },
  })

  console.log(`✅ Course 3 created: ${course3.title}`)

  await seedGeneralStylesAndLessons([course1.id, course2.id, course3.id])

  /* ─────────────────────────────────────────────
   *  COURSE ACCESS & PROGRESS
   * ───────────────────────────────────────────── */
  console.log('\n📚 Setting up course access & progress...')

  const studentId = userIds['student@elizabeth.com']
  const student2Id = userIds['student2@elizabeth.com']

  if (studentId) {
    // Student 1: Access to course 1 (permanent) and course 2 (30 days)
    await prisma.courseAccess.upsert({
      where: { userId_courseId: { userId: studentId, courseId: course1.id } },
      update: {},
      create: { userId: studentId, courseId: course1.id, accessUntil: null },
    })
    await prisma.courseAccess.upsert({
      where: { userId_courseId: { userId: studentId, courseId: course2.id } },
      update: {},
      create: {
        userId: studentId,
        courseId: course2.id,
        accessUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    console.log('  ✅ Course access for Ana (courses 1 & 2)')

    // Module progress for student 1 (first 3 modules of course 1 completed)
    const modules1 = await prisma.module.findMany({
      where: { courseId: course1.id },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    for (let i = 0; i < Math.min(3, modules1.length); i++) {
      await prisma.moduleProgress.upsert({
        where: { userId_moduleId: { userId: studentId, moduleId: modules1[i].id } },
        update: { completed: true, completedAt: new Date() },
        create: { userId: studentId, moduleId: modules1[i].id, completed: true, completedAt: new Date() },
      })
    }
    console.log('  ✅ Module progress for Ana (3/5 modules)')
  }

  if (student2Id) {
    // Student 2: Access to course 1
    await prisma.courseAccess.upsert({
      where: { userId_courseId: { userId: student2Id, courseId: course1.id } },
      update: {},
      create: { userId: student2Id, courseId: course1.id, accessUntil: null },
    })

    // Module progress for student 2 (first module only)
    const modules1 = await prisma.module.findMany({
      where: { courseId: course1.id },
      orderBy: { order: 'asc' },
      select: { id: true },
      take: 1,
    })
    if (modules1.length > 0) {
      await prisma.moduleProgress.upsert({
        where: { userId_moduleId: { userId: student2Id, moduleId: modules1[0].id } },
        update: { completed: true, completedAt: new Date() },
        create: { userId: student2Id, moduleId: modules1[0].id, completed: true, completedAt: new Date() },
      })
    }
    console.log('  ✅ Course access & progress for Laura (1/5 modules)')
  }

  /* ─────────────────────────────────────────────
   *  BUSINESS HOURS & SETTINGS
   * ───────────────────────────────────────────── */
  console.log('\n🕐 Seeding business hours & settings...')

  // Business hours (Mon-Fri 09:00-19:00, Sat 10:00-14:00)
  const schedule = [
    { dayOfWeek: 1, openTime: '09:00', closeTime: '19:00' },
    { dayOfWeek: 2, openTime: '09:00', closeTime: '19:00' },
    { dayOfWeek: 3, openTime: '09:00', closeTime: '19:00' },
    { dayOfWeek: 4, openTime: '09:00', closeTime: '19:00' },
    { dayOfWeek: 5, openTime: '09:00', closeTime: '19:00' },
    { dayOfWeek: 6, openTime: '10:00', closeTime: '14:00' },
  ]

  await prisma.businessHours.deleteMany({})
  for (const entry of schedule) {
    await prisma.businessHours.create({ data: entry })
  }
  console.log('  ✅ Business hours (L-V 09-19, S 10-14)')

  // Settings
  await prisma.settings.upsert({
    where: { id: 'global' },
    update: {},
    create: { id: 'global', feePercent: 2.5, feeFixedCents: 25, defaultCurrency: 'EUR' },
  })
  console.log('  ✅ Settings (2.5% + 0.25€)')

  /* ─────────────────────────────────────────────
   *  FAQ ITEMS
   * ───────────────────────────────────────────── */
  console.log('\n❓ Seeding FAQ items...')

  await prisma.faqItem.deleteMany({})
  const faqItems = [
    { question: '¿Cómo puedo reservar una cita?', answer: 'Puedes reservar directamente desde nuestra página web en la sección de Booking. Selecciona el servicio, profesional, fecha y hora que prefieras.', order: 0 },
    { question: '¿Qué método de pago aceptan?', answer: 'Aceptamos pagos con tarjeta de crédito/débito a través de Stripe. El pago se realiza de forma segura al momento de la reserva.', order: 1 },
    { question: '¿Los cursos tienen certificado?', answer: 'Sí, al completar todos los módulos y aprobar el examen final, recibirás un certificado digital verificable con código QR.', order: 2 },
    { question: '¿Puedo cancelar mi cita?', answer: 'Puedes cancelar o reprogramar tu cita hasta 24 horas antes. Contacta con nosotras a través de la plataforma.', order: 3 },
    { question: '¿Cuánto dura el acceso a los cursos?', answer: 'Depende del curso. Algunos ofrecen acceso permanente y otros acceso por un período limitado (generalmente 30 días). Consulta la descripción de cada curso.', order: 4 },
  ]

  for (const item of faqItems) {
    await prisma.faqItem.create({ data: item })
  }
  console.log(`  ✅ ${faqItems.length} FAQ items`)

  /* ─────────────────────────────────────────────
   *  CHAT ROOMS
   * ───────────────────────────────────────────── */
  console.log('\n💬 Seeding chat rooms...')

  // Community room
  const existingCommunity = await prisma.chatRoom.findFirst({ where: { type: 'COMMUNITY' } })
  if (!existingCommunity) {
    await prisma.chatRoom.create({ data: { type: 'COMMUNITY', name: 'Comunidad General' } })
  }
  console.log('  ✅ Community chat room')

  // Course chat rooms
  for (const course of [course1, course2, course3]) {
    await prisma.chatRoom.upsert({
      where: { courseId: course.id },
      update: {},
      create: { type: 'COURSE', courseId: course.id, name: `Chat: ${course.title}` },
    })
  }
  console.log('  ✅ Course chat rooms (3)')

  /* ─────────────────────────────────────────────
   *  APPOINTMENTS (DEMO)
   * ───────────────────────────────────────────── */
  console.log('\n📅 Seeding demo appointments...')

  const staffId = userIds['staff@elizabeth.com']
  const firstService = await prisma.service.findFirst({ select: { id: true, name: true } })

  if (staffId && studentId && firstService) {
    const now = new Date()
    const appointments = [
      {
        serviceId: firstService.id,
        staffId,
        customerId: studentId,
        startAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
        endAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'CONFIRMED' as const,
        customerName: 'Ana Estudiante',
        customerEmail: 'student@elizabeth.com',
      },
      {
        serviceId: firstService.id,
        staffId,
        customerId: studentId,
        startAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // in 7 days
        endAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        status: 'PENDING' as const,
        customerName: 'Ana Estudiante',
        customerEmail: 'student@elizabeth.com',
      },
      {
        serviceId: firstService.id,
        staffId,
        customerId: student2Id || undefined,
        startAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        endAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        status: 'COMPLETED' as const,
        customerName: 'Laura Estudiante',
        customerEmail: 'student2@elizabeth.com',
      },
    ]

    for (const appt of appointments) {
      await prisma.appointment.create({ data: appt })
    }
    console.log(`  ✅ ${appointments.length} demo appointments`)
  }

  /* ─────────────────────────────────────────────
   *  NOTIFICATIONS (DEMO)
   * ───────────────────────────────────────────── */
  console.log('\n🔔 Seeding demo notifications...')

  const allUserIds = Object.values(userIds)
  for (const uid of allUserIds) {
    const notifications = [
      { type: 'PAYMENT', title: '¡Bienvenida a la plataforma!', message: 'Tu cuenta ha sido creada exitosamente. Explora nuestros cursos y servicios.' },
      { type: 'NEW_COURSE', title: 'Nuevo curso disponible', message: 'El Método Curly Girl: Fundamentos ya está disponible.' },
      { type: 'APPOINTMENT', title: 'Recordatorio de cita', message: 'Tienes una cita programada próximamente.' },
      { type: 'COMMENT', title: 'Nuevo comentario en el curso', message: 'Alguien comentó en un módulo que estás siguiendo.' },
      { type: 'COURSE_COMPLETION', title: '¡Sigue aprendiendo!', message: 'Continúa tu progreso en los cursos.' },
    ]

    for (let i = 0; i < notifications.length; i++) {
      await prisma.notification.create({
        data: {
          userId: uid,
          ...notifications[i],
          isRead: i < 2, // first 2 already read
          createdAt: new Date(Date.now() - (i + 1) * 3600 * 1000), // staggered
        },
      })
    }
  }
  console.log(`  ✅ Notifications for ${allUserIds.length} users`)

  /* ─────────────────────────────────────────────
   *  RESULT IMAGES (DEMO)
   * ───────────────────────────────────────────── */
  console.log('\n🖼️  Seeding demo result images...')

  await prisma.resultImage.deleteMany({})
  const resultImages = [
    { url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=500&fit=crop', label: 'Transformación rizos tipo 3A', aspectRatio: 0.8, width: 400, height: 500, order: 0 },
    { url: 'https://images.unsplash.com/photo-1595475884562-073c30d45670?w=400&h=500&fit=crop', label: 'Definición después de CGM', aspectRatio: 0.8, width: 400, height: 500, order: 1 },
    { url: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400&h=500&fit=crop', label: 'Antes y después plopping', aspectRatio: 0.8, width: 400, height: 500, order: 2 },
    { url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=400&h=500&fit=crop', label: 'Rizos 3B definidos con gel', aspectRatio: 0.8, width: 400, height: 500, order: 3 },
    { url: 'https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=400&h=500&fit=crop', label: 'Hidratación profunda resultado', aspectRatio: 0.8, width: 400, height: 500, order: 4 },
    { url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=400&h=500&fit=crop', label: 'Corte curly transformación', aspectRatio: 0.8, width: 400, height: 500, order: 5 },
  ]

  for (const img of resultImages) {
    await prisma.resultImage.create({ data: img })
  }
  console.log(`  ✅ ${resultImages.length} result images`)

  /* ─────────────────────────────────────────────
   *  TESTIMONIALS (DEMO)
   * ───────────────────────────────────────────── */
  console.log('\n💬 Seeding demo testimonials...')

  await prisma.testimonial.deleteMany({})
  const testimonials = [
    {
      name: 'Ana García',
      role: 'Clienta desde 2022',
      quote: 'Llevaba años luchando con mi rizado. Después de mi primera cita con Elizabeth, salí con el pelo que siempre soñé. El tratamiento de proteína fue increíble.',
      stars: 5,
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
      isActive: true,
      order: 0,
    },
    {
      name: 'María López',
      role: 'Alumna del curso CGM',
      quote: 'El curso de Método Curly Girl cambió completamente mi rutina. Ahora entiendo mi pelo y sé exactamente qué productos usar. Mis rizos nunca estuvieron tan definidos.',
      stars: 5,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
      isActive: true,
      order: 1,
    },
    {
      name: 'Laura Fernández',
      role: 'Clienta habitual',
      quote: 'Probé muchas peluquerías antes de encontrar Apoteósicas. Es la primera vez que alguien realmente entiende mi tipo de rizo. El pack premium vale cada céntimo.',
      stars: 5,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
      isActive: true,
      order: 2,
    },
    {
      name: 'Carmen Ruiz',
      role: 'Clienta desde 2023',
      quote: 'Mi pelo afro necesitaba cuidados especiales y aquí los encontré. La Corona Apoteósica es un tratamiento que recomiendo a todas. Salí sintiéndome una reina.',
      stars: 5,
      avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face',
      isActive: true,
      order: 3,
    },
    {
      name: 'Sofía Martín',
      role: 'Mamá de Mini Curly',
      quote: 'Llevé a mi hija al servicio Mini Curly y fue una experiencia preciosa. Le enseñaron a cuidar sus rizos desde pequeña. Ahora le encanta su pelo natural.',
      stars: 4,
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
      isActive: true,
      order: 4,
    },
    {
      name: 'Isabella Torres',
      role: 'Clienta de mechas',
      quote: 'Las mechas que me hicieron quedaron espectaculares. El color se integra perfecto con mis ondas naturales y el tratamiento posterior dejó mi pelo súper suave.',
      stars: 5,
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face',
      isActive: true,
      order: 5,
    },
  ]

  for (const t of testimonials) {
    await prisma.testimonial.create({ data: t })
  }
  console.log(`  ✅ ${testimonials.length} testimonials`)

  console.log('\n✨ Database seeding completed!')
  console.log(`
Created:
- 4 demo users (admin, staff, 2 students)
- ${course1.title}
- ${course2.title}
- ${course3.title}
- Services & categories (from JSON, with images)
- Course access & module progress
- Business hours & settings
- FAQ items
- Chat rooms (community + per-course)
- Demo appointments
- Demo notifications
- Demo result images
- Demo testimonials (with avatars)

See docs/DEMO_DATA.md for login credentials and details.
  `)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Seed error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
