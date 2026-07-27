import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const raw = readFileSync(join(process.cwd(), "benchmarks/results/latest.csv"), "utf8");
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Benchmark CSV not found." }, { status: 404 });
  }
}
