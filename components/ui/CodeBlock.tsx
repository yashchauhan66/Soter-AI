import React from "react";

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ children, language, className }: CodeBlockProps) {
  const classes = `mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-5 text-xs leading-6 text-slate-300 ${className ?? ""}`;
  return (
    <div className={classes}>
      {language && (
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {language}
        </div>
      )}
      <pre><code>{children}</code></pre>
    </div>
  );
}

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded-md border border-slate-800 bg-slate-950/70 px-1.5 py-0.5 text-xs font-medium text-cyan">
      {children}
    </code>
  );
}

export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-cyan underline decoration-cyan/30 hover:decoration-cyan/70 transition-colors">
      {children}
    </a>
  );
}
