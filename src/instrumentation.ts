export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateRuntime } =
      await import("./server/platform/configuration/environment");
    validateRuntime();
    if (
      process.env.APP_ENV === "development" &&
      process.env.NODE_ENV !== "production"
    ) {
      const { preferIpv4Lookup } =
        await import("./server/platform/configuration/dev-dns");
      preferIpv4Lookup(
        [
          process.env.ORDS_BASE_URL,
          process.env.ORDS_APPS_URL,
          process.env.OIC_BASE_URL,
        ].flatMap((u) => (u ? [new URL(u).hostname] : [])),
      );
    }
  }
}
