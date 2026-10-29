import type { GuideModule } from "../types";
import { home } from "./home";
import { opportunities } from "./opportunities";
import { awards } from "./awards";
/** Menu order. A new module: add a folder with index.ts (metadata) and steps.ts (content), then list it here. */
export const modules: GuideModule[] = [home, opportunities, awards];
