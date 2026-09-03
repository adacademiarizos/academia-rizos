import Link from "next/link";
import {
  ArrowRight,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Smartphone,
} from "lucide-react";
import { getContactContent, type ContactScope } from "@/lib/contact-content";
import { getBusinessHoursLines } from "@/lib/business-hours";

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export default async function ContactSection({
  scope = "ACADEMIA",
}: {
  scope?: ContactScope;
}) {
  const content = await getContactContent(scope);
  const addressLines = content.address.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  // The salon has real opening hours in the BusinessHours table, and that table
  // is what the schedule page shows. Reading them here as well keeps the footer
  // from advertising a different timetable than the page next to it. The
  // academy has no physical opening hours, so it keeps its own written lines.
  const salonHours = scope === "SALON" ? await getBusinessHoursLines() : [];
  const scheduleLines = (
    salonHours.length > 0
      ? salonHours
      : [content.scheduleLine1, content.scheduleLine2, content.scheduleLine3]
  )
    .map((line) => line.trim())
    .filter(Boolean);
  const showAction = Boolean(content.actionLabel.trim() && content.actionHref.trim());
  const actionIsExternal = isExternalHref(content.actionHref);

  return (
    <section id="contacto" className="py-20 px-6 border-t border-white/10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-wider text-ap-copper uppercase mb-2">
            {content.sectionKicker}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-ap-ivory">{content.sectionTitle}</h2>
          <p className="mt-3 text-white/60 text-base max-w-xl mx-auto">{content.sectionDescription}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-ap-copper/20 flex items-center justify-center text-ap-copper">
                <Smartphone className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-ap-ivory">Redes Sociales</h3>
            </div>

            <div className="space-y-3">
              <a
                href={content.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-ap-copper transition group"
              >
                <Instagram className="w-5 h-5" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-ap-ivory group-hover:text-ap-copper transition">
                    Instagram
                  </div>
                  <div className="text-xs text-white/40">{content.instagramHandle}</div>
                </div>
              </a>

              <a
                href={content.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-ap-copper transition group"
              >
                <Music2 className="w-5 h-5" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-ap-ivory group-hover:text-ap-copper transition">
                    TikTok
                  </div>
                  <div className="text-xs text-white/40">{content.tiktokHandle}</div>
                </div>
              </a>

              <a
                href={content.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-ap-copper transition group"
              >
                <Facebook className="w-5 h-5" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-ap-ivory group-hover:text-ap-copper transition">
                    Facebook
                  </div>
                  <div className="text-xs text-white/40">{content.facebookHandle}</div>
                </div>
              </a>

              <a
                href={content.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/70 hover:text-ap-copper transition group"
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-ap-ivory group-hover:text-ap-copper transition">
                    WhatsApp
                  </div>
                  <div className="text-xs text-white/40">{content.whatsappLabel}</div>
                </div>
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-ap-copper/20 flex items-center justify-center text-ap-copper">
                <Mail className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-ap-ivory">Correo Electronico</h3>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{content.emailPrimaryLabel}</div>
                <a
                  href={`mailto:${content.emailPrimary}`}
                  className="text-sm font-medium text-ap-ivory hover:text-ap-copper transition"
                >
                  {content.emailPrimary}
                </a>
              </div>

              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{content.emailSecondaryLabel}</div>
                <a
                  href={`mailto:${content.emailSecondary}`}
                  className="text-sm font-medium text-ap-ivory hover:text-ap-copper transition"
                >
                  {content.emailSecondary}
                </a>
              </div>

              {showAction ? (
                <div>
                  {actionIsExternal ? (
                    <a
                      href={content.actionHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-ap-copper hover:text-ap-copper/80 transition"
                    >
                      {content.actionLabel}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </a>
                  ) : (
                    <Link
                      href={content.actionHref}
                      className="inline-flex items-center gap-1 text-sm font-medium text-ap-copper hover:text-ap-copper/80 transition"
                    >
                      {content.actionLabel}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-ap-copper/20 flex items-center justify-center text-ap-copper">
                <MapPin className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-ap-ivory">{content.locationTitle}</h3>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Direccion</div>
                <p className="text-sm text-ap-ivory font-medium">
                  {addressLines.map((line, idx) => (
                    <span key={`${line}-${idx}`}>
                      {line}
                      <br />
                    </span>
                  ))}
                </p>
              </div>

              {scheduleLines.length > 0 ? (
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Horario</div>
                  <div className="text-sm text-white/70 space-y-0.5">
                    {scheduleLines.map((line, idx) => (
                      <div key={`${line}-${idx}`}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              {content.mapsUrl.trim() ? (
                <a
                  href={content.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-ap-copper hover:text-ap-copper/80 transition mt-2"
                >
                  Ver en Google Maps
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
