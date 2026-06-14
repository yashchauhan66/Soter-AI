import type { runRedTeamSuite } from "./runner";
export type AwaitedReturn = Awaited<ReturnType<typeof runRedTeamSuite>>;
