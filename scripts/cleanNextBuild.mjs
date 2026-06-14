import { rmSync } from "node:fs";
import { join } from "node:path";

for (const path of [join(process.cwd(), ".next"), join(process.cwd(), "tsconfig.tsbuildinfo")]) {
  rmSync(path, { recursive: true, force: true });
}
