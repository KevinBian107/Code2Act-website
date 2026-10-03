/** Shared helpers for the interactive figures. */

export type RGB = [number, number, number];

/** CSS color from a [0, 1] RGB triple. */
export const rgb = (c: RGB | number[], a = 1): string =>
  `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(
    c[2] * 255,
  )}, ${a})`;

/** Resolve a path under `public/` against the site base URL. */
export const asset = (base: string, path: string): string =>
  (base.endsWith("/") ? base : base + "/") + path.replace(/^\//, "");

/** Paper palette for the nine MLB symbols (c2a.codegen.shared.mlb_labels). */
export const MLB: { name: string; color: RGB }[] = [
  { name: "Walk_L", color: [0.1, 0.25, 0.65] },
  { name: "Walk_R", color: [0.55, 0.7, 0.95] },
  { name: "Walk_S", color: [0.3, 0.5, 0.85] },
  { name: "Rear_L", color: [0.1, 0.45, 0.2] },
  { name: "Rear_R", color: [0.55, 0.8, 0.55] },
  { name: "Rear_S", color: [0.25, 0.65, 0.35] },
  { name: "Turn_L", color: [0.8, 0.4, 0.1] },
  { name: "Turn_R", color: [0.95, 0.7, 0.35] },
  { name: "Immobile", color: [0.55, 0.55, 0.55] },
];

/** Behavior-level colors used by the paper's perturbation plots. */
export const BEHAVIOR_COLORS: Record<string, string> = {
  Immobile: "#8c8c8c",
  Rear: "#3aa356",
  Walk: "#4d80d9",
  Turn: "#d9731f",
};

/** Human-readable symbol name: "Walk_L" -> "Walk L". */
export const pretty = (s: string): string => s.replace("_", " ");

export const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));
