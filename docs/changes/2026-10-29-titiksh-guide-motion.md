# Guided learning moves with the app's motion

- **Date / author / agent:** 2026-10-29 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on af86ddf
- **Why:** owner request, 2026-10-29: use the app's animation library (`motion`, the `@/lib/motion` presets) in
  guided learning, at least in the guide selector.
- **What changed:**
  - Guide menu: the panel pops in on open (`pop`, through `useAnimate` on the panel in place, so focus moved into it
    by ArrowDown stays); a module's single guides slide open and closed (`expand` in `AnimatePresence`, as
    `FilterSection`).
  - Tours: driver.js's own 0.4 s ease-in-out CSS fades are off (`body.driver-fade` override in guides.module.css).
    Motion's DOM `animate` pops each step's popover in (`pop`) and fades the overlay in once (`fade`); every way out
    (Escape, the close button, the overlay, Done, past the last step) goes through `leave()`, which plays the exit
    and then calls `destroy()` (`onDestroyStarted`). The stage moves between elements in 250 ms (`--gn-dur`), not 400. With `prefers-reduced-motion: reduce` nothing animates. `motion` loads with driver.js on first use.
- **Shared pieces used or extended:** `pop`, `fade`, `expand` (`@/lib/motion`), the shell's `MotionConfig`.
- **Replaces / overrides:** driver.js's default fade and 400 ms duration.
- **Rules touched:** motion (one easing and duration set for the whole app). No new dependency.
- **Checks:** live DEV: popover opacity 0 → 1 and scale 0.96 → 1 over ~150 ms, no first-frame flash; step 1 → 2
  re-pops; Done fades out in ~100 ms, then the tour closes and is marked finished; the menu panel scales 0.96 → 1;
  the single guides' height grows 0 → 288 px. Unit tests, lint, typecheck and the guide e2e: see the session report.
- **Open:** none.
