import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export function experimentWritesEnabled(): boolean {
  return String(env.EXPERIMENT_WRITES_ENABLED) === "true";
}

export function readOnlyExperimentResponse() {
  return NextResponse.json(
    {
      error: "The published lab is read-only. Its results are recorded evidence from completed experiments.",
      readOnly: true,
    },
    { status: 403 },
  );
}
