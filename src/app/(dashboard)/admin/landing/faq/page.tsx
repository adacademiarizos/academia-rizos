import { db } from "@/lib/db";
import FaqManager from "./FaqManager";

export default async function LandingFaqPage() {
  const items = await db.faqItem.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return <FaqManager initial={items} />;
}
