"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Lightbulb, TriangleAlert } from "lucide-react";
import "./code-block.css";

interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
  title?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ children, language, className, title, showLineNumbers = false }: CodeBlockProps) {
  const [feedback, setFeedback] = useState<{ source: string; state: "idle" | "copied" | "error" }>({ source: "", state: "idle" });
  const copied = feedback.source === children && feedback.state === "copied";
  const copyFailed = feedback.source === children && feedback.state === "error";
  const codeRef = useRef<HTMLPreElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRequest = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      copyRequest.current += 1;
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [children]);

  const handleCopy = useCallback(async () => {
    const request = ++copyRequest.current;
    let successful = false;
    try {
      await navigator.clipboard.writeText(children);
      successful = true;
    } catch {
      const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const textArea = document.createElement("textarea");
      textArea.value = children;
      textArea.readOnly = true;
      textArea.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      try {
        document.body.appendChild(textArea);
        textArea.select();
        successful = document.execCommand("copy") === true;
      } catch {
        successful = false;
      } finally {
        textArea.remove();
        previousFocus?.focus({ preventScroll: true });
      }
    }
    if (!mounted.current || request !== copyRequest.current) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setFeedback({ source: children, state: successful ? "copied" : "error" });
    if (successful) resetTimer.current = setTimeout(() => {
      if (request === copyRequest.current) setFeedback({ source: children, state: "idle" });
    }, 2000);
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
  const regionName = label ? `Code: ${label}` : "Code example";

  // A block whose lines are wider than the screen scrolls sideways. A scroll
  // container the keyboard cannot reach fails WCAG 2.1.1 (axe:
  // scrollable-region-focusable), so a keyboard user could not read the end of a
  // long line.
  //
  // The block is made focusable only while it actually overflows. A tab stop on
  // every block would add seven or eight stops to a page for no benefit, and the
  // region role (which gives the stop a name) would turn each one into a landmark.
  //
  // Set on the element directly, not through state: it depends on layout, so it
  // has to be re-measured when the width changes, and React does not render these
  // attributes itself, so nothing overwrites them on re-render.
  useEffect(() => {
    const pre = codeRef.current;
    if (!pre) return;

    const sync = () => {
      if (pre.scrollWidth > pre.clientWidth + 1 || pre.scrollHeight > pre.clientHeight + 1) {
        pre.tabIndex = 0;
        pre.setAttribute("role", "region");
        pre.setAttribute("aria-label", regionName);
      } else {
        pre.removeAttribute("tabindex");
        pre.removeAttribute("role");
        pre.removeAttribute("aria-label");
      }
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(pre);
    // The text can change width (web font swap) without the block resizing, and a
    // ResizeObserver does not fire for an inline <code>. Measure again once fonts and
    // the page have loaded.
    if (pre.firstElementChild) observer.observe(pre.firstElementChild);
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) sync();
    });
    window.addEventListener("load", sync);
    return () => {
      active = false;
      window.removeEventListener("load", sync);
      observer.disconnect();
    };
  }, [regionName, children]);

  const lines = children.split("\n");
  // Remove trailing empty line
  if (lines[lines.length - 1] === "") lines.pop();

  const classes = `code-block ${className ?? ""}`;

  return (
    <div className={classes}>
      <div className="code-block-header">
        <div className="code-block-labels">
          <span className="code-block-filename" title={title || undefined}>{title || displayLang || "Code"}</span>
          {title && displayLang && title !== displayLang && <span className="code-block-language">{displayLang}</span>}
        </div>
        <button type="button" onClick={handleCopy} className="code-block-copy" data-state={copied ? "copied" : "idle"}
          aria-label={copied ? "Copied" : "Copy code"}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div role="status" className={copyFailed ? "code-block-status code-block-error" : "code-block-status sr-only"}>
        {copied ? "Copied to clipboard" : copyFailed ? "Copy failed. Select the code and copy it manually, or try again." : ""}
      </div>
      <pre ref={codeRef} className="code-block-pre overflow-x-auto" style={{ tabSize: 2, MozTabSize: 2 }}>
        <code className={`language-${langLabel} font-mono`}>
          {showLineNumbers
            ? lines.map((line, i) => (
                <React.Fragment key={i}>
                  <span className="code-block-line-number" aria-hidden="true">{i + 1}</span>
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
      <Lightbulb size={16} aria-hidden="true" className="mt-1 shrink-0 text-cyan" />
      <div>
        {/* The icon is decorative, so the kind of note is stated in text. */}
        <span className="sr-only">Tip: </span>
        {children}
      </div>
    </div>
  );
}

export function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="warn-card mt-4 flex gap-3">
      <TriangleAlert size={16} aria-hidden="true" className="mt-1 shrink-0 text-amber-300" />
      <div>
        <span className="sr-only">Warning: </span>
        {children}
      </div>
    </div>
  );
}
