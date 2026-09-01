/**
 * Section heading.
 *
 * Uses the fluid `display-*` type scale so headings no longer step at
 * breakpoints, and caps the supporting copy at a reading measure — the previous
 * `max-w-3xl` (48rem) let a line run past 100 characters at 1280px, well beyond
 * the 45–75 character range that stays comfortable to read.
 *
 * `as` exists because heading level is a document-structure decision, not a
 * visual one: a section nested inside another section needs an `h3` even when it
 * should look identical to an `h2`. Hard-coding `h2` produced skipped heading
 * levels on the docs and feature-landing pages.
 */
export function SectionHeading({
  eyebrow,
  title,
  copy,
  center = false,
  as: Tag = "h2",
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  center?: boolean;
  as?: "h2" | "h3";
}) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <Tag className="heading-2 mt-3">{title}</Tag>
      {copy && (
        <p className={`mt-4 max-w-prose text-lg leading-8 text-slate-300 ${center ? "mx-auto" : ""}`}>{copy}</p>
      )}
    </div>
  );
}

