import "server-only";
import { fixtureMode } from "@/server/platform/configuration/environment";
/** DEVELOPMENT FIXTURE ONLY: the Awards writes that answer data, in fixture mode where writes never reach Oracle. */
export function fixtureCopyAward() {
  if (!fixtureMode())
    throw new Error(
      "Fixture award writes cannot run outside explicit development mode.",
    );
  return { award_id: 9999 };
}
