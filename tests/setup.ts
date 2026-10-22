import { beforeEach } from "vitest";
import { forget } from "@/server/cache/memo";
// Each test starts with no memoised Oracle data, so one test's mocks never answer another's.
beforeEach(() => forget(""));
