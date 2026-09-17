export const EXTENSION_ID = 'soterai.soterai-ide-guard';
export const EXTENSION_VERSION = '0.6.3';
export const EXTENSION_DISPLAY_NAME = 'SoterAI IDE Guard - AI Security & Secret Protection';
export const EXTENSION_SEARCH_NAME = 'SoterAI IDE Guard';

export const VSCODE_MARKETPLACE_URL =
  'https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard';
export const OPEN_VSX_URL = 'https://open-vsx.org/extension/soterai/soterai-ide-guard';
export const DIRECT_VSIX_URL = `https://open-vsx.org/api/soterai/soterai-ide-guard/${EXTENSION_VERSION}/file/soterai.soterai-ide-guard-${EXTENSION_VERSION}.vsix`;
export const VSIX_SHA256_URL = `https://open-vsx.org/api/soterai/soterai-ide-guard/${EXTENSION_VERSION}/file/soterai.soterai-ide-guard-${EXTENSION_VERSION}.sha256`;
// The source repository is private (proprietary). Nothing on the public site
// may link to it — see LICENSING.md. Issues come in through support instead.
export const ISSUE_URL = 'mailto:support@soterai.in?subject=IDE%20Guard%20issue';

export type EditorIconName = 'code' | 'cursor' | 'windsurf' | 'kiro' | 'antigravity' | 'vscodium';

export type EditorOption = {
  name: string;
  summary: string;
  icon: EditorIconName;
  deepLink: string;
  /**
   * Optional secondary protocol to try. Some editors rebrand their URL
   * protocol across versions (Windsurf -> Devin), and which one is registered
   * depends on the user's install/update history — so we fire both.
   */
  altDeepLink?: string;
  command: string;
  listingUrl: string;
  listingLabel: string;
  status: 'runtime-verified' | 'registry-ready';
  statusDetail: string;
  evidenceFile?: string;
};

export const EDITOR_OPTIONS: EditorOption[] = [
  {
    name: 'Visual Studio Code',
    summary: "Microsoft's extensible code editor",
    icon: 'code',
    deepLink: `vscode:extension/${EXTENSION_ID}`,
    command: `code --install-extension ${EXTENSION_ID}`,
    listingUrl: VSCODE_MARKETPLACE_URL,
    listingLabel: 'VS Marketplace',
    status: 'runtime-verified',
    statusDetail: `Packaged runtime verified on ${EXTENSION_VERSION}`,
    evidenceFile: 'artifacts/editor-runtime/code.json',
  },
  {
    name: 'Cursor',
    summary: 'AI-native software development',
    icon: 'cursor',
    deepLink: `cursor:extension/${EXTENSION_ID}`,
    command: `cursor --install-extension ${EXTENSION_ID}`,
    listingUrl: OPEN_VSX_URL,
    listingLabel: 'Open VSX',
    status: 'runtime-verified',
    statusDetail: `Packaged runtime verified on ${EXTENSION_VERSION}`,
    evidenceFile: 'artifacts/editor-runtime/cursor.json',
  },
  {
    name: 'Windsurf',
    summary: 'Agentic development environment (now Devin)',
    icon: 'windsurf',
    deepLink: `windsurf:extension/${EXTENSION_ID}`,
    altDeepLink: `devin:extension/${EXTENSION_ID}`,
    command: `windsurf --install-extension ${EXTENSION_ID}`,
    listingUrl: OPEN_VSX_URL,
    listingLabel: 'Open VSX',
    status: 'runtime-verified',
    statusDetail: `Packaged runtime verified on ${EXTENSION_VERSION}`,
    evidenceFile: 'artifacts/editor-runtime/windsurf.json',
  },
  {
    name: 'Kiro',
    summary: 'Spec-driven agentic IDE',
    icon: 'kiro',
    deepLink: `kiro:extension/${EXTENSION_ID}`,
    command: `kiro --install-extension ${EXTENSION_ID}`,
    listingUrl: OPEN_VSX_URL,
    listingLabel: 'Open VSX',
    status: 'runtime-verified',
    statusDetail: `Packaged runtime verified on ${EXTENSION_VERSION}`,
    evidenceFile: 'artifacts/editor-runtime/kiro.json',
  },
  {
    name: 'Antigravity',
    summary: 'Agent-first development environment',
    icon: 'antigravity',
    deepLink: `antigravity:extension/${EXTENSION_ID}`,
    command: `antigravity --install-extension ${EXTENSION_ID}`,
    listingUrl: OPEN_VSX_URL,
    listingLabel: 'Open VSX',
    status: 'runtime-verified',
    statusDetail: `Packaged runtime verified on ${EXTENSION_VERSION}`,
    evidenceFile: 'artifacts/editor-runtime/antigravity.json',
  },
  {
    name: 'VSCodium',
    summary: 'Community-built, telemetry-free editor',
    icon: 'vscodium',
    deepLink: `vscodium:extension/${EXTENSION_ID}`,
    command: `codium --install-extension ${EXTENSION_ID}`,
    listingUrl: OPEN_VSX_URL,
    listingLabel: 'Open VSX',
    status: 'registry-ready',
    statusDetail: 'Published on Open VSX; local runtime verification pending',
  },
];
