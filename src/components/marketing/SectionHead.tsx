function SectionHead({
  kicker,
  title,
  subtitle,
  color,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  color?: string;
}) {
  const isCrema = color === "crema";

  return (
    <div className="mx-auto max-w-6xl">
      <h3 className={`font-main text-2xl font-semibold tracking-wide ${isCrema ? "text-ap-choco" : "text-ap-olive"}`}>
        {kicker.toUpperCase()}
      </h3>
      <h2 className={`mt-2 text-balance text-3xl font-semibold tracking-tight md:text-4xl ${isCrema ? "text-zinc-700" : "text-white"}`}>
        {title}
      </h2>
      <p className={`mt-3 max-w-2xl text-sm ${isCrema ? "text-zinc-500" : "text-zinc-300"} md:text-base`}>{subtitle}</p>
    </div>
  );
}

export default SectionHead