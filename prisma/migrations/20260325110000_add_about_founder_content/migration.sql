CREATE TABLE "AboutFounderContent" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "kicker" TEXT NOT NULL DEFAULT 'Sobre Elizabeth',
    "title" TEXT NOT NULL DEFAULT 'Experiencia, tecnica y una comunidad que se siente',
    "subtitle" TEXT NOT NULL DEFAULT 'Un enfoque calido pero profesional. Aca va una bio corta y un CTA fuerte a reservas.',
    "imageUrl" TEXT NOT NULL DEFAULT '/Elizabeth.webp',
    "imageAlt" TEXT NOT NULL DEFAULT 'Elizabeth Rizos',
    "quoteTitle" TEXT NOT NULL DEFAULT 'Tu rizo no es "dificil", esta mal entendido.',
    "quoteBody" TEXT NOT NULL DEFAULT 'El objetivo no es solo que se vea bien hoy: es que tengas una rutina clara, productos adecuados y tecnica para mantener definicion, hidratacion y forma.',
    "primaryCtaLabel" TEXT NOT NULL DEFAULT 'Conocer el salon',
    "primaryCtaHref" TEXT NOT NULL DEFAULT '/salon',
    "secondaryCtaLabel" TEXT NOT NULL DEFAULT 'Ver academia',
    "secondaryCtaHref" TEXT NOT NULL DEFAULT '/academia',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AboutFounderContent_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AboutFounderContent" ("id")
VALUES ('global')
ON CONFLICT ("id") DO NOTHING;
