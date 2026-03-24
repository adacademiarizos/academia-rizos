import { db } from "@/lib/db";
import ResultsUploader from "./ResultsUploader";

export default async function LandingResultsPage() {
  const images = await db.resultImage.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return <ResultsUploader initial={images} />;
}
