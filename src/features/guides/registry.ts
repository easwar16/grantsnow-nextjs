import type { Guide, GuideModule, GuideStep } from "./types";
import { modules as registered } from "./modules";
/** Every guide with its module's route and access applied. */
export function resolve(modules: readonly GuideModule[]): Guide[] {
  return modules.flatMap((module) =>
    module.guides.map((g) => ({
      ...g,
      route: g.route ?? module.route,
      access: g.access ?? module.access,
      module,
    })),
  );
}
export const guides = resolve(registered);
const allowed = (g: Guide, access: readonly string[]) =>
  g.access === undefined || access.includes(g.access);
/** Guides for a route that the user's navigation grants allow; a missing grant hides the guide. */
export function guidesFor(path: string, access: readonly string[]) {
  return guides.filter((g) => g.route === path && allowed(g, access));
}
/** Guides the user may run, grouped by module in menu order; empty modules drop out. */
export function guideMenu(access: readonly string[]) {
  return registered
    .map((module) => {
      const own = guides.filter(
        (g) => g.module === module && allowed(g, access),
      );
      return {
        module,
        tour: own.find((g) => g.auto),
        items: own.filter((g) => !g.auto),
      };
    })
    .filter((m) => m.tour || m.items.length > 0);
}
/** A guide's steps, loading its module's content on first use. */
export async function loadSteps(g: Guide): Promise<GuideStep[]> {
  return (await g.module.steps()).default[g.id] ?? [];
}
export const doneKey = (g: Guide) => `gn-guide:${g.id}:v${g.version}`;
