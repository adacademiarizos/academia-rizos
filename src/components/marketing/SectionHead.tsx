function SectionHead({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <h3 className=" font-main text-2xl font-semibold tracking-wide text-(--er-olive)">
        {kicker.toUpperCase()}
      </h3>
      <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight md:text-4xl text-white ">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-zinc-300 md:text-base">{subtitle}</p>
    </div>
  );
}

export default SectionHead