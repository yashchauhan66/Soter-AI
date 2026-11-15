import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const filename = path.join(process.cwd(), "public/brand/soterai-symbol.svg");
const master = readFileSync(filename);

// Check actual rendered pixels, not just an SVG label claiming to be a cube.
// The three faces and clear gaps must remain visible on the 64px master canvas.
test("the website symbol renders a three-face cube within an open hexagonal guard", async () => {
  const { data, info } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 64);
  assert.equal(info.height, 64);
  const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
  assert.deepEqual(pixel(32, 3), [249, 100, 3, 255], "The orange hexagonal frame apex is missing");
  assert.deepEqual(pixel(32, 22), [249, 100, 3, 255], "The top cube face is missing");
  assert.deepEqual(pixel(22, 35), [178, 59, 11, 255], "The copper left cube face is missing");
  assert.deepEqual(pixel(42, 35), [20, 17, 15, 255], "The ink right cube face is missing");
  assert.equal(pixel(32, 37)[3], 0, "The central cube seam must stay transparent");
  assert.equal(pixel(14, 32)[3], 0, "The cube must be separated from its outer frame");
  assert.equal(pixel(2, 2)[3], 0, "The mark must not regain a solid square backdrop");
});

process.on("exit", () => console.log("SOTER_CUBE_MASTER_CONSUMED " + JSON.stringify({ path: filename, sha256: createHash("sha256").update(master).digest("hex") })));
