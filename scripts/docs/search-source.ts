import ts from "typescript";
import { docsSlug } from "../../lib/docs/slug";
import type { DocsSearchHeading } from "../../lib/docs/search";

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const entities = (value: string) => value.replace(/&(?:amp|apos|quot|lt|gt|nbsp);/g, (entity) => ({ "&amp;": "&", "&apos;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&nbsp;": " " })[entity] ?? entity);

/** Static AST extraction only: never evaluate page modules or example code. */
function collect(node: ts.Node): string {
  const parts: string[] = [];
  const visit = (item: ts.Node) => {
    if (ts.isImportDeclaration(item) || ts.isExportDeclaration(item)) return;
    if (ts.isVariableDeclaration(item) && item.name.getText() === "metadata") return;
    if (ts.isJsxAttribute(item)) {
      if (["title", "label", "summary", "description"].includes(item.name.getText()) && item.initializer && ts.isStringLiteral(item.initializer)) parts.push(item.initializer.text);
      return;
    }
    if (ts.isJsxText(item) || ts.isStringLiteral(item) || ts.isNoSubstitutionTemplateLiteral(item)) parts.push(entities(item.text));
    else if (ts.isTemplateExpression(item)) {
      parts.push(item.head.text, ...item.templateSpans.map((span) => span.literal.text));
    }
    ts.forEachChild(item, visit);
  };
  visit(node);
  return clean(parts.join(" "));
}

function headingText(node: ts.JsxElement): string {
  return clean(node.children.map((child) => {
    if (ts.isJsxText(child)) return entities(child.text);
    if (ts.isJsxExpression(child) && child.expression && (ts.isStringLiteral(child.expression) || ts.isNoSubstitutionTemplateLiteral(child.expression))) return child.expression.text;
    return "";
  }).join(" "));
}

export function extractDocsText(source: string): { body: string; headings: DocsSearchHeading[] } {
  const file = ts.createSourceFile("docs-page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const headings: DocsSearchHeading[] = [];
  const seen = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const name = node.openingElement.tagName.getText();
      if (["DocsHeading", "h2", "h3"].includes(name)) {
        const title = headingText(node);
        const attribute = node.openingElement.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.getText() === "id");
        const explicit = attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : undefined;
        const id = explicit ?? (name === "DocsHeading" ? docsSlug(title) : "");
        if (title && id && !seen.has(id)) {
          let section: ts.Node = node;
          for (let parent = node.parent; parent; parent = parent.parent) {
            if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText() === "section") { section = parent; break; }
          }
          headings.push({ id, title, text: collect(section) });
          seen.add(id);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { body: collect(file), headings };
}
