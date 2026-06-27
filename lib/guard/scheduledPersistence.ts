import { after } from "next/server";
import { persistGuardResult } from "./persistence";

type PersistGuardResultInput = Parameters<typeof persistGuardResult>[0];

export function scheduleGuardResultPersistence(input: PersistGuardResultInput) {
  after(() =>
    persistGuardResult(input).catch((error) =>
      console.error("[SoterAI] Guard persistence failed for project", input.projectId, error),
    ),
  );
}
