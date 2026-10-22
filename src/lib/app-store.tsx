"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

/**
 * The app store (useReducer + Context): data the browser has loaded once, shared by every component and page that
 * needs it, as VBCS holds `$application.variables` and GN-Angular held its in-memory state. It holds only the
 * allowlisted display models our API routes return, never raw Oracle bodies.
 *
 * Each entry is keyed by its request. A key has at most one request in flight (concurrent readers share it), and
 * only the latest request for a key may settle it, so a slow earlier answer never replaces a newer one. Readers see
 * the last data at once while a newer copy loads (stale-while-revalidate); `ttl` says how long data counts as fresh.
 */
export type StoreError = { code: string; message: string; action?: string };
export type StoreResult<T> =
  { ok: true; data: T } | { ok: false; error: StoreError };
type Entry = {
  data?: unknown;
  error?: StoreError;
  loading: boolean;
  /** When the data last settled (ms); 0 before that. */
  at: number;
};
type State = Record<string, Entry>;
type Action =
  | { type: "start"; key: string }
  | { type: "settle"; key: string; result: StoreResult<unknown>; at: number }
  | { type: "patch"; key: string; data: unknown }
  | { type: "forget"; prefix: string };

const EMPTY: Entry = { loading: false, at: 0 };

export function storeReducer(state: State, action: Action): State {
  switch (action.type) {
    case "start": {
      const entry = state[action.key] ?? EMPTY;
      return entry.loading
        ? state
        : { ...state, [action.key]: { ...entry, loading: true } };
    }
    case "settle": {
      const entry = state[action.key] ?? EMPTY;
      return {
        ...state,
        [action.key]: action.result.ok
          ? { data: action.result.data, loading: false, at: action.at }
          : // A failure keeps the last good data beside the error.
            { ...entry, error: action.result.error, loading: false },
      };
    }
    case "patch":
      return {
        ...state,
        [action.key]: {
          ...(state[action.key] ?? EMPTY),
          data: action.data,
          error: undefined,
        },
      };
    case "forget": {
      const next = { ...state };
      for (const key of Object.keys(next))
        if (key.startsWith(action.prefix)) delete next[key];
      return next;
    }
  }
}

type Loader<T> = () => Promise<StoreResult<T>>;
export type StoreApi = {
  /** The entry's result: fresh data at once, otherwise the shared in-flight request or a new one. */
  load<T>(
    key: string,
    loader: Loader<T>,
    options?: { ttl?: number; force?: boolean },
  ): Promise<StoreResult<T>>;
  /** Starts a read on intent (hover, focus) without waiting for it; reads only. */
  prefetch<T>(key: string, loader: Loader<T>, ttl?: number): void;
  /** Replaces an entry's data after a write the client already knows the result of. */
  patch(key: string, data: unknown): void;
  /** Drops entries whose key starts with `prefix`; an answer still in flight for them is discarded. */
  forget(prefix: string): void;
};

// The one store of this page, for module-level helpers (hover prefetches) that run outside a component's render.
let registered: StoreApi | null = null;
/** The mounted store's API, or null outside the authenticated shell. */
export const appStore = () => registered;

const StateContext = createContext<State | null>(null);
const ApiContext = createContext<StoreApi | null>(null);

/**
 * The store's behaviour without React: one request per key in flight, latest wins, fresh data served at once.
 * It mirrors the reducer's state by applying the same pure reducer to each action it sends, so it always knows the
 * latest entries without reading React state during render.
 */
export function createStoreApi(send: (action: Action) => void): StoreApi {
  const inFlight = new Map<string, Promise<StoreResult<unknown>>>();
  let snapshot: State = {};
  const dispatch = (action: Action) => {
    snapshot = storeReducer(snapshot, action);
    send(action);
  };
  const getState = () => snapshot;

  const start = <T,>(key: string, loader: Loader<T>) => {
    const running = inFlight.get(key);
    if (running) return running as Promise<StoreResult<T>>;
    dispatch({ type: "start", key });
    const request = loader().catch((): StoreResult<T> => ({
      ok: false,
      error: {
        code: "UPSTREAM",
        message: "This request could not be completed.",
      },
    }));
    inFlight.set(key, request as Promise<StoreResult<unknown>>);
    void request.then((result) => {
      // Latest wins: a forgotten or superseded request never settles the entry.
      if (inFlight.get(key) !== request) return;
      inFlight.delete(key);
      dispatch({ type: "settle", key, result, at: Date.now() });
    });
    return request;
  };
  const load: StoreApi["load"] = (
    key,
    loader,
    { ttl = 0, force = false } = {},
  ) => {
    const entry = getState()[key];
    if (
      !force &&
      entry?.at &&
      entry.data !== undefined &&
      Date.now() - entry.at < ttl
    )
      return Promise.resolve({ ok: true, data: entry.data as never });
    return start(key, loader);
  };
  return {
    load,
    prefetch(key, loader, ttl = 0) {
      void load(key, loader, { ttl });
    },
    patch(key, data) {
      inFlight.delete(key);
      dispatch({ type: "patch", key, data });
    },
    forget(prefix) {
      for (const key of inFlight.keys())
        if (key.startsWith(prefix)) inFlight.delete(key);
      dispatch({ type: "forget", prefix });
    },
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, {});
  // One stable API object: components that only trigger loads never re-render on data.
  const api = useMemo(() => createStoreApi(dispatch), []);
  useEffect(() => {
    registered = api;
    return () => {
      if (registered === api) registered = null;
    };
  }, [api]);
  return (
    <ApiContext.Provider value={api}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ApiContext.Provider>
  );
}

export function useStoreApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useStoreApi outside AppStoreProvider");
  return api;
}

/**
 * Reads `key` through the store: shows the held data at once, loads (or shares the load) when it is missing or
 * older than `ttl`, and re-runs when the key changes. `null` reads nothing.
 */
export function useStoreRead<T>(
  key: string | null,
  loader: Loader<T>,
  { ttl = 0 }: { ttl?: number } = {},
) {
  const api = useStoreApi();
  const state = useContext(StateContext);
  const entry = key ? state?.[key] : undefined;
  // The loader is an inline closure; the latest one is used without re-running the effect.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  useEffect(() => {
    if (key) void api.load(key, () => loaderRef.current(), { ttl });
  }, [api, key, ttl]);
  return {
    data: entry?.data as T | undefined,
    error: entry?.error,
    loading: !entry || entry.loading,
    reload: () =>
      key
        ? api.load(key, () => loaderRef.current(), { force: true })
        : Promise.resolve(undefined),
  };
}
