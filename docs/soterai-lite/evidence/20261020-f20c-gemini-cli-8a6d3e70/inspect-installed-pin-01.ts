import { verifyInstalledGeminiCli, geminiStampsCurrent } from "../../../../packages/vscode-extension/src/adapters/GeminiCliRuntimePin";
import { writeFile } from "node:fs/promises";
async function main() { const stamps = await verifyInstalledGeminiCli(), result = { status: await geminiStampsCurrent(stamps) ? "PASS_PUBLIC_INSTALLED_PIN_ONLY" : "FAIL", entries: stamps.length, files: stamps.filter(s => !s.directory).length, directories: stamps.filter(s => s.directory).length, time: new Date().toISOString(), scope: "Public installed package/dependency/Node only; no native launch, normal profile read or product route claim." };
    await writeFile(new URL("installed-runtime-pin-verification-01.json", import.meta.url), JSON.stringify(result, null, 2) + "\n", { flag: "wx" }); console.log(JSON.stringify(result)); }
main().catch(e => { console.error(e); process.exitCode = 1; });
