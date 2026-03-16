/**
 * Seed data for Elizabeth Rizos Platform - Academy + Services
 * Creates test courses with modules, resources, and tests
 * Creates service categories, services, variants, and staff prices
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()

const __dirname = dirname(fileURLToPath(import.meta.url))

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
  await prisma.variantStaffPrice.deleteMany({});
  await prisma.serviceVariant.deleteMany({});
  await prisma.serviceStaffPrice.deleteMany({});
  await prisma.service.deleteMany({});
  console.log("  🗑️  Cleared existing services data");

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
  // Seed services & categories first
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
      trailerUrl:
        'https://example.com/trailers/curly-girl-basics.mp4',
      priceCents: 2999, // $29.99 USD
      currency: 'USD',
      rentalDays: null, // Lifetime access
      isActive: true,

      // Create modules
      modules: {
        create: [
          {
            order: 1,
            title: '¿Qué es realmente el Método Curly Girl?',
            description:
              'Introducción a los principios fundamentales del CGM y por qué funciona para rizos naturales.',
            videoUrl: 'https://example.com/courses/course1/module1.mp4',
            transcript:
              'En este módulo aprendemos que el Método Curly Girl es un protocolo de cuidado capilar específicamente diseñado para pelos rizados...',
          },
          {
            order: 2,
            title: 'Análisis de tu tipo de rizo',
            description:
              'Descubre cómo identificar tu tipo de rizo (patron, porosidad, densidad) para elegir los mejores productos.',
            videoUrl: 'https://example.com/courses/course1/module2.mp4',
            transcript:
              'Cada rizo es único. Entender tu tipo de rizo es el primer paso para un rutina efectiva...',
          },
          {
            order: 3,
            title: 'Ingredientes a evitar y buscar',
            description:
              'Guía completa de ingredientes: cuáles daña tus rizos y cuáles los potencian.',
            videoUrl: 'https://example.com/courses/course1/module3.mp4',
            transcript:
              'Los productos incorrectos pueden arruinar tus rizos. Aprende a leer etiquetas...',
          },
          {
            order: 4,
            title: 'Rutina básica: Lavado y acondicionamiento',
            description:
              'Paso a paso de cómo lavar y acondicionar tus rizos correctamente.',
            videoUrl: 'https://example.com/courses/course1/module4.mp4',
            transcript:
              'La técnica de lavado es crucial. No se trata solo de champú, sino de cómo lo aplicamos...',
          },
          {
            order: 5,
            title: 'Creming your waves: Técnica de definición',
            description:
              'Aprende la técnica de "creaming" para máxima definición de rizos.',
            videoUrl: 'https://example.com/courses/course1/module5.mp4',
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
            fileUrl: 'https://example.com/resources/cgm-chart.pdf',
            fileName: 'Guia-Nutrientes-CGM.pdf',
          },
          {
            type: 'IMAGE',
            fileUrl: 'https://example.com/resources/hair-types-chart.jpg',
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
      trailerUrl:
        'https://example.com/trailers/nutrition-curls.mp4',
      priceCents: 1999, // $19.99 USD - cheaper for shorter course
      currency: 'USD',
      rentalDays: 30, // 30-day rental access
      isActive: true,

      modules: {
        create: [
          {
            order: 1,
            title: 'La conexión entre nutrición y salud capilar',
            description:
              'Descubre por qué la nutrición interna es crucial para rizos hermosos.',
            videoUrl: 'https://example.com/courses/course2/module1.mp4',
            transcript: 'El cabello es un reflejo de nuestra salud interna...',
          },
          {
            order: 2,
            title: 'Vitaminas y minerales esenciales',
            description:
              'Cuáles son las vitaminas y minerales que necesitan tus rizos.',
            videoUrl: 'https://example.com/courses/course2/module2.mp4',
            transcript:
              'Hierro, zinc, biotina, vitamina B12... aprende qué hace cada uno...',
          },
          {
            order: 3,
            title: 'Plan de alimentación pro-rizos',
            description:
              'Crea tu propio plan de comidas para nutrición óptima del cabello.',
            videoUrl: 'https://example.com/courses/course2/module3.mp4',
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
              'https://example.com/resources/nutrient-food-pairing.pdf',
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
      trailerUrl:
        'https://example.com/trailers/advanced-styling.mp4',
      priceCents: 3999, // $39.99 USD - premium course
      currency: 'USD',
      rentalDays: null, // Lifetime
      isActive: true,

      modules: {
        create: [
          {
            order: 1,
            title: 'Herramientas esenciales para formar rizos',
            description:
              'Qué herramientas necesitas y cómo usarlas correctamente.',
            videoUrl: 'https://example.com/courses/course3/module1.mp4',
            transcript: 'Difusor, plopping towel, difusor de secador...',
          },
          {
            order: 2,
            title: 'Técnica del Plopping - Paso a paso',
            description:
              'Domina la técnica de plopping para moldear tus rizos.',
            videoUrl: 'https://example.com/courses/course3/module2.mp4',
            transcript: 'El plopping es clave para distribuir productos...',
          },
          {
            order: 3,
            title: 'Praying Hands y Microus: Técnicas de aplicación',
            description:
              'Aprende dos métodos diferentes para aplicar productos.',
            videoUrl: 'https://example.com/courses/course3/module3.mp4',
            transcript:
              'Cada técnica tiene sus ventajas según tu tipo de rizo...',
          },
          {
            order: 4,
            title: 'Secado y afinamiento (Drying & Diffusing)',
            description:
              'Técnicas profesionales para secar sin encrespar.',
            videoUrl: 'https://example.com/courses/course3/module4.mp4',
            transcript: 'El difusor es tu mejor amigo para rizos...',
          },
          {
            order: 5,
            title: 'Troubleshooting: Soluciona problemas comunes',
            description:
              'Qué hacer cuando algo no sale bien en tu rutina.',
            videoUrl: 'https://example.com/courses/course3/module5.mp4',
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
              'https://example.com/resources/styling-techniques-guide.pdf',
            fileName: 'Guia-Tecnicas-Avanzadas.pdf',
          },
          {
            type: 'IMAGE',
            fileUrl:
              'https://example.com/resources/hand-positions-comparison.jpg',
            fileName: 'Posiciones-Manos-Tecnicas.jpg',
          },
        ],
      },
    },
  })

  console.log(`✅ Course 3 created: ${course3.title}`)

  console.log('\n✨ Database seeding completed!')
  console.log(`
Created:
- ${course1.title}
- ${course2.title}
- ${course3.title}

You can now test these courses in your application!
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
