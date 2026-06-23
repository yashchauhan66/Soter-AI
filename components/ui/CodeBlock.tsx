"use client";

import React, { useCallback, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
  title?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ children, language, className, title, showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = children;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [children]);

  const langLabel = language ? language.toLowerCase() : "";
  const displayLang =
    langLabel === "ts" || langLabel === "typescript"
      ? "TypeScript"
      : langLabel === "bash" || langLabel === "sh" || langLabel === "shell"
        ? "Terminal"
        : langLabel === "python" || langLabel === "py"
          ? "Python"
          : langLabel === "json"
            ? "JSON"
            : langLabel === "go"
              ? "Go"
              : langLabel === "java"
                ? "Java"
                : langLabel === "php"
                  ? "PHP"
                  : langLabel === "csharp" || langLabel === "c#"
                    ? "C#"
                    : langLabel === "html"
                      ? "HTML"
                      : langLabel === "text"
                        ? ""
                        : langLabel;

  const label = title ?? displayLang;
  const lines = children.split("\n");
  // Remove trailing empty line
  if (lines[lines.length - 1] === "") lines.pop();

  const classes = `mt-4 overflow-hidden rounded-xl border border-slate-800 bg-[#0d1117] text-sm ${className ?? ""}`;

  return (
    <div className={classes}>
      {label && (
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-2.5">
          <div className="flex items-center gap-3">
            {displayLang && (
              <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {displayLang}
              </span>
            )}
            {title && !displayLang && (
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
            aria-label={copied ? "Copied" : "Copy code"}
          >
            {copied ? (
              <>
                <Check size={12} className="text-lime" aria-hidden="true" />
                <span className="text-lime">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre
        ref={codeRef}
        className="overflow-x-auto p-4 leading-7"
        style={{ tabSize: 2, MozTabSize: 2 }}
      >
        <code className={`language-${langLabel} font-mono text-slate-200`}>
          {showLineNumbers
            ? lines.map((line, i) => (
                <React.Fragment key={i}>
                  <span className="mr-4 inline-block w-8 select-none text-right text-slate-600">
                    {i + 1}
                  </span>
                  <span>{line || "\u00A0"}</span>
                  {i < lines.length - 1 && "\n"}
                </React.Fragment>
              ))
            : children}
        </code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded-md border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-xs font-medium text-cyan font-mono">
      {children}
    </code>
  );
}

export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-cyan underline decoration-cyan/30 underline-offset-2 transition-colors hover:decoration-cyan/70">
      {children}
    </a>
  );
}

export function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="tip-card mt-4 flex gap-3">
      <span className="mt-0.5 shrink-0 text-cyan">💡</span>
      <div>{children}</div>
    </div>
  );
}

export function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="warn-card mt-4 flex gap-3">
      <span className="mt-0.5 shrink-0 text-amber-300">⚠️</span>
      <div>{children}</div>
    </div>
  );
}
