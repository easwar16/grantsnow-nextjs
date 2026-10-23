import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Marks the work of a write request. The Oracle client reads fresh inside it (and refreshes the held copy), so the
 * checks a write depends on (status, lock, ownership, uniqueness) always see Oracle as it is now.
 */
const scope = new AsyncLocalStorage<{ write: true }>();
export const asWrite = <T>(work: () => Promise<T>) =>
  scope.run({ write: true }, work);
export const inWrite = () => scope.getStore()?.write === true;
