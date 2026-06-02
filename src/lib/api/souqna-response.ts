import { NextResponse } from "next/server";

export class SouqnaApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "SouqnaApiError";
  }
}

export function souqnaJson<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function souqnaErrorResponse(error: unknown) {
  if (error instanceof SouqnaApiError) {
    return souqnaJson({ error: error.message }, error.status);
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message.includes("Rate limit exceeded")) {
    return souqnaJson({ error: "Rate limit exceeded" }, 429);
  }
  console.error("[souqna-api]", error);
  return souqnaJson({ error: "Internal server error" }, 500);
}
