import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "scripts/guard-benchmark/results.json");
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Benchmark results not found. Run `python scripts/guard-benchmark/run_garak_benchmark.py` first." },
      { status: 404 }
    );
  }
}
