export function SectionHeading({ eyebrow, title, copy, center = false }: { eyebrow: string; title: string; copy?: string; center?: boolean }) {
  return <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}><p className="eyebrow">{eyebrow}</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>{copy && <p className="mt-4 text-lg leading-8 text-slate-400">{copy}</p>}</div>;
}
