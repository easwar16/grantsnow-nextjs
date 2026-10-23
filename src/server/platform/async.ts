import "server-only";
/**
 * Marks a promise started early and awaited later: a rejection before that await (e.g. an earlier check threw)
 * must not surface as an unhandled rejection. Awaiting the returned promise still throws its error.
 */
export function early<T>(promise: Promise<T>) {
  promise.catch(() => {});
  return promise;
}
/** Runs `tasks` with at most `limit` in flight; results keep the input order and the first failure rejects. */
export async function bounded<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]();
      } catch (e) {
        // The result is lost anyway; start no more tasks.
        next = tasks.length;
        throw e;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker),
  );
  return results;
}
