# API layer

Every backend call goes through two single entry points:

- **Server → Oracle:** `@/server/oracle/api`, made of functions defined with `read` / `write` from `@/server/oracle/client`.
- **Browser → this app:** `@/lib/api`, made of endpoints and write functions over `@/lib/api/http`, plus the `useApi` / `usePagedApi` hooks.

The browser never calls Oracle. Tokens, OIC credentials and ORDS access stay on the server (foundations rule). The reference module is Comments:

- `src/server/oracle/api/comments.ts`
- `src/server/record/objects/comments.ts`
- `src/app/api/objects/comments/**`
- `src/lib/api/endpoints/objects.ts`
- `src/features/record/objects/comments.tsx`

## Layers

| Layer         | File                                                      | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection    | `src/server/oracle/connection.ts`                         | The allowlist (`operations.json`), the undici pool and the one-shot read retry, timeouts, the writes gate, fixtures, ORDS error mapping. Nothing else imports `oracle()` / `oracleWrite()`, except the session module, which runs before a session exists.                                                                                                                                                                                     |
| Context       | `src/server/oracle/context.ts`                            | The signed-in user for this request: the token, plus `legal_id`, `org_id` and `user_id` from the verified session.                                                                                                                                                                                                                                                                                                                             |
| Client        | `src/server/oracle/client.ts`                             | `read` / `write` definitions. Identity injection, caching, paging and invalidation.                                                                                                                                                                                                                                                                                                                                                            |
| Cache         | `src/server/oracle/cache.ts`                              | The one server cache: per session, TTL, shared in-flight requests, failures never held. `memo` is for derived values only. It lives on `globalThis`, because route handlers (writes) and pages (reads) can load it as separate module instances, and a write's invalidation must reach the pages. It is per server process: running more than one instance needs sticky sessions, or a write on one leaves another's copy stale until its TTL. |
| API           | `src/server/oracle/api/<area>.ts`                         | One function per operation, with its parameters, response schema, cache policy and paging.                                                                                                                                                                                                                                                                                                                                                     |
| Services      | `src/server/<module>/*.ts`                                | Access checks, business rules, display models. They call API functions with plain parameters.                                                                                                                                                                                                                                                                                                                                                  |
| Routes        | `src/app/api/**/route.ts`                                 | `route(handler, { write, onError })` from `@/server/http/route`. Only file-streaming routes keep a custom handler.                                                                                                                                                                                                                                                                                                                             |
| Browser API   | `src/lib/api/endpoints/<area>.ts`, `src/lib/api/index.ts` | `endpoint(...)` / `pagedEndpoint(...)` for reads, and functions that return an `ApiResult` for writes. Components never build `/api` URLs.                                                                                                                                                                                                                                                                                                     |
| Browser hooks | `src/lib/api/hooks.ts`                                    | `useApi(endpoint, params)` and `usePagedApi(endpoint, params)`, both over the app store.                                                                                                                                                                                                                                                                                                                                                       |

## Defining an Oracle API function

```ts
export const thread = read<{ page: string; objectId: string }, CommentRow[]>({
  op: "getProposalComments",
  query: (p) => ({ module: p.page, object_id: p.objectId }),
  parse: (b) => rows.parse(b).items,
});
export const add = write<{ page: string; objectId: string; comments: string }>({
  op: "postProposalComments",
  identity: ["legal_id", "org_id", "user_id"],
  body: (p) => ({
    module: p.page,
    comments: p.comments,
    object_id: Number(p.objectId),
  }),
  invalidates: ["getProposalComments"],
});
```

- **Parameters are plain values.** Map them to `headers` / `query` / `path` in the definition, using the exact legacy names from the call site.
- **Never pass `token`.** Name the identity fields in `identity`, and only those the operation declares in `operations.json`. Never assume `org_id` is the user's org: `p_org_id` is often the organisation picked on screen, so it is a parameter.
- **`parse`** is the zod schema the service used to apply. The function returns the parsed model, not the raw body.
- **Caching** (owner, 2026-10-23): what the live app caches, plus the holds the owner approved for performance. Every other read has no `ttl`, so it is read when asked, and identical reads within one request still share one call.
  - **What the live app caches:** labels, global variables, dashboard preferences and roles, themes, user preferences and their LOVs, funders, people, org units, lookups, object dates, new flags, person status and notifications. The source is the GrantsNow KB, Shared-Features § _App-level data the VBCS app holds_.
  - **Approved beyond the live app (`TTL.config`):** data the app never writes. That is sponsors, funder types, call codes, finder filter options, groups and roles, approval groups, and object-attribute and dynamic-form definitions.
  - **Approved beyond the live app (`TTL.access`):** a record's own data for a visit (request details, locked modules, finalizable pages, the opportunity behind it, its attachments and links), finder pages and announcements.
  - **Home's figures:** KPIs, queues, Insights, Dynamic Charts and the gauge use `ttl: TTL.figures, stale: TTL.figuresStale`. They are fresh for 3 minutes, then served for up to 10 more while one background read refreshes them.
  - **Browser holds:** dialog setups are held for 30 s, and shared reference lists for 5 min.
  - **Writes always read fresh.** Inside a `route(..., { write: true })` request, every read goes to Oracle and refreshes the held copy (`server/oracle/scope.ts`). A held copy never decides whether a write may go ahead.
- **`invalidates`** lists every read a write changes. It replaces each `forgetRead` / `forget` that followed the old write. They are dropped whether the write succeeds or fails, because a timed-out write may still have committed.
- **Paging:**
  - `pages: "all"` is for a reference list the backend pages (25 rows, `hasMore: "true"` as a string, `p_offset` / `p_limit`). It is read whole, within a fixed bound.
  - `pages: "page"` is for one listing page. Pass `offset` / `limit` as parameters, and use `asPage(body, mapRow)` for `{ items, hasMore }`.
  - Listings whose legacy paging uses other parameter names keep those names in `query` and do not use `pages`.
- **Abort signals:** pass `{ signal }` for reads the user can supersede. A read with a signal is never shared or held.
- **No behaviour change.** Same operation, same headers, query and body, same order of awaits, same parallelism. A migration that changes a payload is a defect.

## Routes

```ts
export const GET = route((request) => commentsView(searchOf(request)));
export const POST = route(
  async (request) => addComment(searchOf(request), await commentBody(request)),
  {
    write: true, // refuses a cross-origin request first
    onError: badComment,
  },
);
```

## Browser

```ts
export const comments = endpoint<PanelRecord, CommentsView>((p) => ({
  path: "/objects/comments",
  query: panel(p),
}));
export const addComment = (p: PanelRecord, html: string) =>
  post("/objects/comments", { comments: html }, panel(p));

const { data, error, retry } = useApi(objects.comments, record); // null params read nothing
const list = usePagedApi(eoi.list, filters); // rows, last, hasMore, total, loadMore, loading, loadingMore, stale, error, retry, reload
```

- **Same parameters, same data.** The store key is the endpoint URL with its sorted query. Every component asking for it shares one request and answers from the store; changed parameters load fresh.
- **Paged lists** (TanStack `useInfiniteQuery`):**
  - Each page is held under its parameters plus its index.
  - `loadMore` appends the next page.
  - A filter change starts again from page one.
  - The route answers `{ rows, hasMore }` or whatever its `page()` mapper reads.
- **Paged lists** are held per parameters, so a tab or filter already seen shows at once and refreshes in the background. New parameters keep the previous rows on screen (`stale`: dim them with `aria-busy` and make them `inert`) until their first page arrives. Show a skeleton only when nothing is held (`loading && !last`) or for the next page (`loadingMore`), never for a background refresh. `retry()` asks a failed next page again.
- **After a write,** call `retry()` on the reads it changed, or `useForget()("/path")` to drop every held page of a listing. To show a saved change wherever a list is held without re-reading it, rewrite the held rows with the store's `update(prefix, change)` (the finder's `patchHeldRow`).
- **The signed-in user** (name, organisation, module access; never tokens or `legal_id`) is held in the shell (`useCurrentUser()`). Read it from there; never pass it to routes, which take identity from the session.

## Tests

Mock `@/server/oracle/connection` (`oracle`, `oracleWrite`) and `@/server/oracle/context` (`oracleContext`). Compare only the leading call arguments, because the client also passes optional signal, query and path arguments (see `lead()` in `tests/integration/object-panels.test.ts`). Each module keeps its existing tests green. Update a test only where it pins how the code is wired, never what it does.
