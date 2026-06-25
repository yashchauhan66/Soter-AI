"use client";

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ChatMarkdown — a tiny, dependency-free, XSS-safe markdown renderer for the
// AI assistant. Supports: headings (#/##/###), **bold**, `inline code`,
// ```code blocks```, bullet/numbered lists, and [links](url).
// React escapes all text by default, so no raw HTML is ever injected.
// ─────────────────────────────────────────────────────────────────────────────

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  // Reset stateful regex between calls.
  INLINE_RE.lastIndex = 0;

  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.8em] text-cyan"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (link) {
        nodes.push(
          <a
            key={`${keyPrefix}-l${i}`}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan underline underline-offset-2 hover:text-cyan/80"
          >
            {link[1]}
          </a>
        );
      }
    }
    lastIndex = INLINE_RE.lastIndex;
    i++;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function ChatMarkdown({ content }: { content: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence ```
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/80 p-3 font-mono text-xs text-slate-200"
        >
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Heading #/##/###
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const cls =
        level === 1
          ? "text-[15px] font-bold"
          : level === 2
            ? "text-sm font-bold"
            : "text-sm font-semibold";
      const k = key++;
      blocks.push(
        <p key={k} className={`${cls} mt-1 text-white`}>
          {renderInline(heading[2], `h${k}`)}
        </p>
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i++;
      }
      const k = key++;
      blocks.push(
        <ul key={k} className="list-disc space-y-1 pl-4">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ul${k}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      const k = key++;
      blocks.push(
        <ol key={k} className="list-decimal space-y-1 pl-4">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ol${k}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (collect consecutive plain lines)
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```")
    ) {
      para.push(lines[i]);
      i++;
    }
    const k = key++;
    blocks.push(
      <p key={k} className="whitespace-pre-wrap leading-relaxed">
        {renderInline(para.join("\n"), `p${k}`)}
      </p>
    );
  }

  return <div className="space-y-2">{blocks}</div>;
}
