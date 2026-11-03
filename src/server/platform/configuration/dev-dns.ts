import dns from "node:dns";
import { serverConstants } from "@/server/constants";
type Callback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;
/**
 * Development only. Some home routers stall on IPv6 (AAAA) lookups: Node then waits ~6 s per lookup and
 * parallel Home reads hit its 10 s connect timeout. The Oracle hosts publish no IPv6, so resolve them over
 * IPv4 first (cached a minute) and fall back to the normal lookup; every other host is untouched.
 */
export function preferIpv4Lookup(hosts: string[]) {
  const targets = new Set(hosts),
    original = dns.lookup,
    cache = new Map<string, { at: number; address: string }>();
  const patched = (
    hostname: string,
    options: number | dns.LookupOptions | Callback,
    callback?: Callback,
  ) => {
    const done = (typeof options === "function" ? options : callback)!;
    const opts =
      typeof options === "number"
        ? { family: options }
        : typeof options === "function"
          ? {}
          : options;
    const passThrough = () =>
      typeof options === "function"
        ? original(hostname, done)
        : original(hostname, opts, done);
    if (
      !targets.has(hostname) ||
      (opts.family !== undefined && opts.family !== 0 && opts.family !== 4)
    )
      return passThrough();
    const reply = (address: string) =>
      opts.all ? done(null, [{ address, family: 4 }]) : done(null, address, 4);
    const hit = cache.get(hostname);
    if (hit && Date.now() - hit.at < serverConstants.ttl.devDns)
      return process.nextTick(reply, hit.address);
    original(hostname, { family: 4 }, (err, address) => {
      if (err) return passThrough();
      cache.set(hostname, { at: Date.now(), address });
      reply(address);
    });
  };
  dns.lookup = patched as unknown as typeof dns.lookup;
}
