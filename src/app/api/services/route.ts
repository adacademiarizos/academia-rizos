import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const services = await db.service.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      billingRule: true,
      depositPct: true,
      imageUrls: true,
      typeOfService: true,
      order: true,
      categoryId: true,
      category: { select: { id: true, name: true, slug: true, order: true } },
      prices: { select: { priceCents: true, currency: true } },
      variants: {
        where: { isActive: true },
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          durationMin: true,
          order: true,
          staffPrices: { select: { priceCents: true, currency: true } },
        },
      },
    },
  });

  // Enrich each service with price range and variant price info
  const enriched = services.map((s) => {
    const hasVariants = s.variants.length > 0;
    let minPriceCents: number | null = null;
    let maxPriceCents: number | null = null;
    let currency = "EUR";

    if (hasVariants) {
      const allPrices = s.variants.flatMap((v) => v.staffPrices.map((p) => p.priceCents));
      if (allPrices.length > 0) {
        minPriceCents = Math.min(...allPrices);
        maxPriceCents = Math.max(...allPrices);
        currency = s.variants[0]?.staffPrices[0]?.currency ?? "EUR";
      }
    } else {
      const allPrices = s.prices.map((p) => p.priceCents);
      if (allPrices.length > 0) {
        minPriceCents = Math.min(...allPrices);
        maxPriceCents = Math.max(...allPrices);
        currency = s.prices[0]?.currency ?? "EUR";
      }
    }

    const variants = s.variants.map((v) => {
      const vPrices = v.staffPrices.map((p) => p.priceCents);
      return {
        id: v.id,
        name: v.name,
        durationMin: v.durationMin,
        order: v.order,
        minPriceCents: vPrices.length > 0 ? Math.min(...vPrices) : null,
        maxPriceCents: vPrices.length > 0 ? Math.max(...vPrices) : null,
        currency: v.staffPrices[0]?.currency ?? "EUR",
      };
    });

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      billingRule: s.billingRule,
      depositPct: s.depositPct,
      imageUrls: s.imageUrls,
      typeOfService: s.typeOfService,
      order: s.order,
      categoryId: s.categoryId,
      categoryName: s.category?.name ?? null,
      categorySlug: s.category?.slug ?? null,
      hasVariants,
      variants,
      minPriceCents,
      maxPriceCents,
      currency,
    };
  });

  // Group by category
  const catMap = new Map<string, { categoryId: string; categoryName: string; categorySlug: string; services: typeof enriched }>();
  for (const s of enriched) {
    const key = s.categoryId ?? "__uncategorized";
    if (!catMap.has(key)) {
      catMap.set(key, {
        categoryId: s.categoryId ?? "",
        categoryName: s.categoryName ?? "Otros",
        categorySlug: s.categorySlug ?? "otros",
        services: [],
      });
    }
    catMap.get(key)!.services.push(s);
  }

  const groupedByCategory = Array.from(catMap.values()).sort((a, b) => {
    const aOrder = services.find((s) => s.categoryId === (a.categoryId || null))?.category?.order ?? 999;
    const bOrder = services.find((s) => s.categoryId === (b.categoryId || null))?.category?.order ?? 999;
    return aOrder - bOrder;
  });

  return NextResponse.json({
    ok: true,
    data: { services: enriched, groupedByCategory },
  });
}
