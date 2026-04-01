import ContactContentEditor from "./ContactContentEditor";
import { getAllContactContent } from "@/lib/contact-content";

export default async function LandingContactPage() {
  const initial = await getAllContactContent();
  return <ContactContentEditor initial={initial} />;
}
