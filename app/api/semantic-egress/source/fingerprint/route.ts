import { NextResponse } from "next/server";
import { fingerprintSemanticSource } from "@/lib/semantic-egress";

export async function POST(request: Request) {
  const body = await request.json();
  const result = fingerprintSemanticSource(body);
  return NextResponse.json(result);
}
