import { NextResponse } from "next/server";
import { checkSemanticEgress } from "@/lib/semantic-egress";

export async function POST(request: Request) {
  const body = await request.json();
  const result = checkSemanticEgress(body);
  return NextResponse.json(result);
}
