export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateRuntime } =
      await import("./server/configuration/environment");
    validateRuntime();
  }
}
