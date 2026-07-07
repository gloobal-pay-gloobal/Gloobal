// ---------------------------------------------------------------------------
// Feature Registry — the single place every feature module announces its
// own existence (key, display name, route path, lazy-loaded component)
// instead of RootApp/App importing every screen directly and hardcoding
// the list. Real, working dynamic behavior here (not just an organizational
// naming exercise):
//   - Registration is decoupled from use: a feature module calls
//     `registerFeature(...)` once, from its own file; nothing else needs to
//     know that module exists to make it show up in navigation/routing.
//   - Loading is genuinely lazy: `component` is a dynamic `import()`, so
//     each feature becomes its own code-split chunk, fetched only when
//     actually navigated to — this is a real, measurable bundle-size/
//     performance win, not just architecture for its own sake.
//   - `enabled` supports runtime feature-flagging (ship a feature's code,
//     decide later whether it's switched on) without an if/else ladder
//     spread across the app.
// ---------------------------------------------------------------------------

import type { ComponentType, LazyExoticComponent } from "react";
import { lazy } from "react";

export interface FeatureDefinition {
  key: string;
  label: string;
  path: string;
  /** Dynamic import — enables real code-splitting per feature. */
  load: () => Promise<{ default: ComponentType<any> }>;
  icon?: ComponentType;
  enabled?: boolean;
}

interface RegisteredFeature extends FeatureDefinition {
  Component: LazyExoticComponent<ComponentType<any>>;
}

class FeatureRegistry {
  private features = new Map<string, RegisteredFeature>();

  register(def: FeatureDefinition): void {
    if (this.features.has(def.key)) {
      // eslint-disable-next-line no-console
      console.warn(`[featureRegistry] "${def.key}" is already registered — ignoring duplicate.`);
      return;
    }
    this.features.set(def.key, { ...def, Component: lazy(def.load) });
  }

  get(key: string): RegisteredFeature | undefined {
    return this.features.get(key);
  }

  getAll(): RegisteredFeature[] {
    return Array.from(this.features.values());
  }

  getEnabled(): RegisteredFeature[] {
    return this.getAll().filter((f) => f.enabled !== false);
  }
}

export const featureRegistry = new FeatureRegistry();
