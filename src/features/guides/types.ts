export type GuideStep = {
  /** Stable element id from the page; a missing element skips the step. */
  target?: string;
  /** For repeated records whose ids carry a record key: the first match is used. */
  selector?: string;
  /** Id of a tab (`role="tab"`) selected before the step, for content that mounts only on its tab. */
  open?: string;
  title: string;
  body: string;
  side?: "top" | "right" | "bottom" | "left";
};
/** Menu metadata only; a guide's steps live in its module's steps file. */
export type GuideDefinition = {
  id: string;
  /** Bumping it shows the guide again to users who finished an older one. */
  version: number;
  title: string;
  /** Defaults to the module's route. */
  route?: string;
  /** Defaults to the module's access. */
  access?: string;
  /** The module's full tour: started from the module's name in the menu and by itself on the first visit. At most one per module. */
  auto?: boolean;
};
/** One menu group. Steps load on first use so the menu stays light as content grows. */
export type GuideModule = {
  id: string;
  label: string;
  route: string;
  /** Navigation entry the user must be granted (drawer id); omitted only for pages every signed-in user reaches. */
  access?: string;
  guides: GuideDefinition[];
  steps: () => Promise<{ default: Record<string, GuideStep[]> }>;
};
/** A guide with its module defaults applied. */
export type Guide = Required<Pick<GuideDefinition, "route">> &
  Omit<GuideDefinition, "route"> & { module: GuideModule };
