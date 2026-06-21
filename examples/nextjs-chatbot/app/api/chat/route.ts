import { NextResponse } from "next/server";

const apiKey = process.env.SOTER_API_KEY;

export async function POST(request: Request) {
  const { message } = await request.json();

  const response = await fetch(`${process.env.SOTER_BASE_URL || "https://api.soter.dev"}/api/guard/input`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  const result = await response.json();
  return NextResponse.json(result);
}
