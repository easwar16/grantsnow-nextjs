import type { FinderFilters, FinderTab } from "./state";
/**
 * The finder's app-scoped state (the original's `filterEOIListing` / `filterEOIListingTab` and the sections'
 * open state): it survives client navigation and is lost on reload, as GN-Angular's root FinderState. Written only
 * from client effects, so the server's copy of this module always keeps its defaults.
 */
export const remembered: {
  filters?: FinderFilters;
  tab: FinderTab | null;
  sections: Record<
    "funders" | "status" | "funderType" | "fundingType" | "dateSort",
    boolean
  >;
} = {
  tab: null,
  // Funders and status start open (filterSectionExpanded).
  sections: {
    funders: true,
    status: true,
    funderType: false,
    fundingType: false,
    dateSort: false,
  },
};
