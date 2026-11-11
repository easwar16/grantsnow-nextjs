# Partly-done items and a live pass: 9555, 8483, preferences and profile by measurement, dynamic chart modules

- **Date / author / agent:** 2026-11-05 / titiksh / Claude Code
- **Branch / base commit:** Saurabh on `10e996d` (after `2026-11-05-titiksh-legacy-catchup-9549-9548.md`)
- **Why:** owner, 2026-11-05: finish the partly-done items, then browser-test what is left. Each change below comes
  from legacy source or a measurement on 621 (live DEV), side by side with the rebuild at the same viewport.
- **What changed:**
  - **9555** (`home-start-page.html`, MR 15914): the Proposals by Year legend names its series by `status_code`
    (`dashboard › labels › proposals-by-year-submitted` / `-awarded`, else "Submitted" / "Awarded", else the
    status text); the drill still uses the code. Title fallback "Submitted vs Awarded Proposals by Year". The RB seed
    was regenerated from legacy `strings.js` (`scripts/resource-seed.mjs`), which also brings the Claims redesign
    and 9559 keys.
  - **8483** (`object-attachments` `attachmentMessage`): the upload and delete toasts read
    `warning-messages.file-upload-successfull` / `labels.attachment-delete-success` from the record's bundle, with
    legacy's fallbacks.
  - **Preferences drawer** (621, award 1183 and Home): width follows its content up to `31.25rem` (375px, was a fixed
    312px) and the whole drawer scrolls; title 15px/800; headings 12px/700 on 18px lines; 15px side padding; theme
    buttons three to a row (stretching), 3px radius; Save 52 × 28 in a sticky bar right after the content (was
    pinned to the bottom); infolet switches 27 × 15 with a 12px thumb and the on colour, labels 600, children 30px
    in, 77px rows. Every value measured within 1–2px of 621.
  - **Manage profile:**
    - tabs on `TabBar` (new backwards-compatible `align="stretch"`, as 621's equal tabs);
    - Preference fields on `MultiSelect` (new `allowCustom`, legacy `oj-combobox-many`: pick or type) in a 30px box
      under the label, replacing a native `<datalist>` with an Add button;
    - Manage tab in `InsideField`s at legacy's widths (status, dates, org and proxy 25%, message 52%, table 70%);
    - Save 52px.
  - **Dynamic Charts:** a selector for every configured module the user can open (legacy `getDynamicTabs`), not only
    modules with a visible chart; 621 shows AWARD, the rebuild did not.
  - **Featured Opportunities** heading from `header-labels.featured-opportunities` (legacy panel-title), and an id
    on the attachment link anchor (self-check findings in my earlier code).
- **Verified live, no code change:** 9548 (both year charts filter to the selected year), 9319 (`ReadonlyField`
  wraps within its cell as 621: 408 vs 410px, 30px for two lines), Help → Tutorials, live notifications, chatbot
  send and reply, Opportunities Bookmarked (0) and Shared (the same 5 in order) as 621.
- **Shared pieces used or extended:** `MultiSelect` (`allowCustom`), `TabBar` (`stretch`), `InsideField`,
  `Select`, `DataTable`, the attachments view, `mapWidget`/`loadWidget`, `dashboardTabs`.
- **Replaces / overrides:**
  - the drawer's fixed `26rem` width (owner, 2026-10-27, "rem as legacy") keeps the rem limits but now sizes by
    content, as legacy's `.vb-configure-drawer` does (`min-width: 20rem; max-width: 31.25rem`, no width);
  - the switch knob look from `b04d853` (36 × 20, round) is replaced by the measured 27 × 15 track and 12px square
    thumb; the off colour is unchanged (every 621 switch was on, so it was not measured);
  - Reset keeps its icon: legacy declares `oj-ux-ico-restore`, which simply does not render on 621.
- **Rules touched:** none. Hide-not-disable and fail-closed RB kept: the Shared tab's Comments stays hidden because
  `share-comments` is seeded `N` and DEV has no row, although legacy shows it ungated.
- **Checks:** typecheck clean; lint 0 errors (the existing warning); 101 files / 941 tests; isolated build passed;
  e2e 42 passed, 2 skipped, 0 failed. Live DEV reads as above; no live writes (profile edits not saved, Dimension not saved).
- **Open:**
  - attachments upload, the 9549 size note and the 8483 toasts need OIC on the local server ("File storage is not
    connected here"); the agent cannot read the env files to check why;
  - DEV RB rows: `proposals-by-year` still "Proposals by Year"; `share-comments` missing (Comments hidden);
  - Dimension save and the deadline-warning dialog were not run live (writes / Apply);
  - an AWARD module with no visible chart shows an empty area (legacy keeps showing the previous module's charts,
    a defect);
  - Home's section tabs and the dynamic-chart selector are buttonsets in legacy but use a hand-built
    `role="tablist"`; `TabBar` draws underline tabs, so they need a shared buttonset (owner's call);
  - the guide's §9 id check (`perl … "$ARGV:".(…)+1`) prints `1` instead of the file and line, because of operator
    precedence; it should be `my $n=(…)+1; print "$ARGV:$n"`.
