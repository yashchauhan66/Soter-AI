import type { Metadata } from "next";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "SoterAI Lite: Privacy, License and Local Guard",
  description:
    "SoterAI Lite for Windows developers: managed AI route protection, privacy, recovery limits, license and third-party notices.",
  alternates: { canonical: "/docs/soterai-lite" },
};

const documents = [
  { name: "Privacy statement", file: "PRIVACY.md", description: "Local data, provider traffic, telemetry defaults and retained encrypted data." },
  { name: "License", file: "LICENSE.md", description: "The complete Business Source License 1.1 and additional use grant." },
  { name: "Third-party notices", file: "THIRD-PARTY-NOTICES.md", description: "Bundled components and their applicable license notices." },
];

const settingsCode = `{
  "soterai.cloud.enabled": false,
  "soterai.privacyMode": "local",
  "soterai.scan.remoteEscalation": "never",
  "soterai.telemetry.redactedEvents": "off",
  "soterai.audit.storeRawPrompts": false,
  "soterai.dependencyGuard.osvMode": "ask"
}`;

export default function SoteraiLiteDocsPage() {
  return (
    <DocsPageShell path="/docs/soterai-lite">
      <section className="docs-section">
        <DocsHeading>Protection scope</DocsHeading>
        <p className="mt-3 leading-7 text-slate-200">
          SoterAI Lite helps Windows developers reduce accidental secret sharing through
          supported managed AI routes. Protection depends on the configured tool and route.
          Unmanaged file reads and uploads remain outside this protection, and code running
          as the same user can bypass cooperative controls. This is not an OS sandbox,
          a universal file-access firewall or a guarantee that secrets cannot leave the machine.
        </p>
        <p className="mt-3 leading-7 text-slate-200">
          This guide covers the <InlineCode>packages/soterai-lite</InlineCode> source for the
          0.7.0 Windows x64 pre-release candidate, not every Marketplace version. Its exact-package
          final acceptance and publication remain unverified. Linux, macOS, remote and virtual
          workspaces have not been accepted for this candidate. Check the version and its own
          documentation before installing.
        </p>
        <a className="mt-4 inline-block text-cyan underline" href="https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard">
          View published Marketplace versions
        </a>
      </section>

      <section className="docs-section">
        <DocsHeading>Install and check the local candidate</DocsHeading>
        <p className="mt-3 leading-7 text-slate-200">
          The package keeps the extension identity <InlineCode>soterai.soterai-ide-guard</InlineCode>{" "}
          and existing <InlineCode>soterai.*</InlineCode> settings. Its manifest requires VS Code{" "}
          <InlineCode>^1.85.0</InlineCode>; the packaging script targets <InlineCode>win32-x64</InlineCode>.
          The build includes the extension, local AI broker and MCP server. Local setup requires no
          SoterAI account, administrator access, VM or external controller; optional AI providers can
          have their own account requirements.
        </p>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-7 text-slate-200">
          <li>Obtain a trusted VSIX for the version and Windows target you intend to evaluate. In the editor&apos;s Extensions menu, choose <strong>Install from VSIX</strong>. The Marketplace link above does not establish that this exact candidate is published.</li>
          <li>Open one local filesystem project. Review workspace trust before enabling integrations or file changes; restricted mode still permits local analysis.</li>
          <li>Run <strong>SoterAI: Open Control Panel</strong>, then <strong>SoterAI: Run Safe Demo Scan</strong>. Use the built-in example rather than real credentials for an initial check.</li>
          <li>Run <strong>SoterAI: Show AI Route Coverage</strong>. Review a tool&apos;s proposed configuration changes before opting in. A setting, badge or synthetic demo is not proof that a real tool used the managed route.</li>
        </ol>
      </section>

      <section className="docs-section">
        <DocsHeading>Local defaults and optional network routes</DocsHeading>
        <p className="mt-3 leading-7 text-slate-200">
          These are the declared machine-scoped defaults, shown for review in User Settings rather
          than as a project policy to distribute. Local live scanning is enabled by default and can
          inspect supported content without asking before each local scan. Managed safe-file releases,
          configuration changes and vault migration have separate review requirements.
        </p>
        <CodeBlock language="json" title="User settings — selected defaults">{settingsCode}</CodeBlock>
        <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-slate-200">
          <li><strong>Provider traffic:</strong> the OpenAI-compatible and Anthropic-compatible provider URL settings start blank. Configuring a provider and routing a tool through the broker can send inspected public code and text, including values the filters do not recognize. Turning the separate cloud preference off does not disable provider traffic.</li>
          <li><strong>Dependency advisories:</strong> owner-invoked checks can ask to send package names, ecosystems and versions to OSV. The default is <InlineCode>ask</InlineCode>; <InlineCode>never</InlineCode> keeps those checks on local heuristics. The MCP dependency check is an offline advisory, not a complete vulnerability audit.</li>
          <li><strong>Telemetry:</strong> redacted events are off by default. The inspected telemetry sender has no remote send implementation; an opt-in may show minimized metadata in the editor&apos;s telemetry output. Editor, operating-system and other vendors&apos; telemetry are separate.</li>
          <li><strong>Managed scope:</strong> a trusted window can start its own loopback broker. Use its current displayed URL, not an assumed fixed port. Other tools, direct file reads and independent uploads remain outside the broker. Approved readers can share returned text, and an application given vaulted values can transmit them.</li>
        </ul>
      </section>

      <section className="docs-section">
        <DocsHeading>Privacy and license documents</DocsHeading>
        <p className="mt-3 leading-7 text-slate-200">
          These are versioned reference copies for 0.7.0. SoterAI Lite uses the
          Business Source License 1.1. Its additional use grant allows non-production use and
          internal production use within a single entity. Commercial hosted or managed AI-security
          services for third parties and competing products require a separate commercial license.
          Read the complete terms rather than treating the Marketplace&apos;s Free label as unrestricted use.
          The license specifies a Change Date of 2030-06-25 and Apache License 2.0 as the Change License,
          subject to its version-specific timing terms.
        </p>
        <p className="mt-3 leading-7 text-slate-200">
          The current packaging script includes LICENSE.md and PRIVACY.md, and generates
          THIRD-PARTY-NOTICES.md from the components bundled in each build. The notices linked here
          are an archived 0.7.0 reference. Check the exact VSIX for its build-specific notices;
          these website links are not proof of the contents of an installed package.
        </p>
        <ul className="mt-5 space-y-4">
          {documents.map((document) => (
            <li key={document.file}>
              <a className="text-cyan underline" href={`/soterai-lite/0.7.0/${document.file}`}>
                {document.name} (Markdown)
              </a>
              <p className="mt-1 text-sm leading-6 text-slate-300">{document.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="docs-section">
        <DocsHeading>Recovery and removal</DocsHeading>
        <p className="mt-3 leading-7 text-slate-200">
          Removing the extension does not automatically restore protected files or erase retained
          policy and encrypted backup data. Before uninstalling, stop managed tool sessions and review
          the undo commands for changes you enabled, such as <strong>Restore Broker Integration</strong>{" "}
          and the tool-specific configuration restores. Changed files or ownership can prevent a restore;
          retain the receipt and resolve the conflict rather than forcing an overwrite.
        </p>
        <p className="mt-3 leading-7 text-slate-200">
          <strong>Complete Safe Vault Recovery</strong> handles interrupted migration. Restoring original
          values through <strong>Restore File From Encrypted Backup</strong> is a separate explicit disclosure:
          it makes sensitive values readable in the project again. Saved restrictions do not prevent other
          same-user software from reading those originals. Encryption keys use VS Code SecretStorage;
          ciphertext without the required keys is not a usable recovery plan.
        </p>
        <p className="mt-3 leading-7 text-slate-200">
          The versioned privacy statement describes a <strong>Restore changes before removal</strong>{" "}
          archive flow, but this source snapshot does not register that general command. Do not assume
          automatic archival or post-uninstall recovery in your build. Verify the installed version&apos;s
          actual recovery receipt and preserve required encrypted backups and key access before deleting
          extension storage or an editor profile. No recovery flow can recall prior uploads or guarantee
          protection from code running as the same user.
        </p>
        <a className="mt-4 inline-block text-cyan underline" href="https://github.com/yashchauhan66/Soter-AI/issues">
          Report an issue
        </a>
      </section>
    </DocsPageShell>
  );
}
