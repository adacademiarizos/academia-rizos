import Link from "next/link";
import SectionHead from "./SectionHead";
import { getAboutFounderContent } from "@/lib/about-founder-content";

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function CtaLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className: string;
}) {
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

async function AboutFounder() {
  const content = await getAboutFounderContent();
  const showPrimaryCta =
    content.primaryCtaLabel.trim().length > 0 && content.primaryCtaHref.trim().length > 0;
  const showSecondaryCta =
    content.secondaryCtaLabel.trim().length > 0 && content.secondaryCtaHref.trim().length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHead
        kicker={content.kicker}
        title={content.title}
        subtitle={content.subtitle}
      />

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:align-middle">
        <div className="overflow-hidden rounded-3xl border border-black/10 bg-white/40">
          <img
            src={content.imageUrl}
            alt={content.imageAlt || "Imagen fundadora"}
            className="h-full w-full max-h-125 object-top object-cover"
            loading="lazy"
          />
        </div>

        <div className="rounded-3xl p-8 backdrop-blur-md">
          {content.quoteTitle.trim().length > 0 && (
            <h3 className="text-6xl text-white font-main font-semibold">{content.quoteTitle}</h3>
          )}
          {content.quoteBody.trim().length > 0 && (
            <p className="mt-3 text-sm text-zinc-400 md:text-base">{content.quoteBody}</p>
          )}

          {(showPrimaryCta || showSecondaryCta) && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {showPrimaryCta && (
                <CtaLink
                  href={content.primaryCtaHref}
                  label={content.primaryCtaLabel}
                  className="rounded-2xl bg-(--er-copper) px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
                />
              )}
              {showSecondaryCta && (
                <CtaLink
                  href={content.secondaryCtaHref}
                  label={content.secondaryCtaLabel}
                  className="rounded-2xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AboutFounder;
