import AboutFounderEditor from "./AboutFounderEditor";
import { getAboutFounderContent } from "@/lib/about-founder-content";

export default async function LandingAboutFounderPage() {
  const initial = await getAboutFounderContent();
  return <AboutFounderEditor initial={initial} />;
}
