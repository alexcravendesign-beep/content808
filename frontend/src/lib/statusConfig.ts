/**
 * Centralised status color configuration.
 *
 * All status-related colour maps live here so there's a single source of truth.
 * Each consumer imports only the map it needs.
 */

export type ContentStatus = "idea" | "draft" | "review" | "approved" | "blocked" | "scheduled" | "published";

export const ALL_STATUSES: ContentStatus[] = [
    "idea", "draft", "review", "approved", "blocked", "scheduled", "published",
];

/** Brand color per status (tailwind class name, no prefix). */
const PALETTE: Record<ContentStatus, string> = {
    idea: "indigo",
    draft: "violet",
    review: "amber",
    approved: "emerald",
    blocked: "red",
    scheduled: "blue",
    published: "cyan",
};

/** Solid background (e.g. status pills/badges). */
export const STATUS_BG_SOLID: Record<string, string> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, `bg-${PALETTE[s]}-500`]),
);

/** Light background + translucent border (calendar items, lanes). */
export const STATUS_BG_LIGHT: Record<string, string> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, `bg-${PALETTE[s]}-500/10 border-${PALETTE[s]}-500/20`]),
);

/** Lane border colour at 40 % opacity (kanban). */
export const STATUS_BORDER: Record<string, string> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, `border-${PALETTE[s]}-500/40`]),
);

/** Left-border strip (week grid items). */
export const STATUS_STRIP: Record<string, string> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, `border-l-${PALETTE[s]}-500`]),
);

/** Small dot colour. */
export const STATUS_DOT: Record<string, string> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, `bg-${PALETTE[s]}-400`]),
);

/** Card hover glow (group-hover shadow). */
export const STATUS_GLOW: Record<string, string> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, `group-hover:shadow-${PALETTE[s]}-500/10`]),
);

/** KPI strip bg/text combo. */
export const STATUS_KPI: Record<string, string> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, `bg-${PALETTE[s]}-500/20 text-${PALETTE[s]}-400`]),
);

/** Lane light background (kanban). */
export const STATUS_BG_LANE: Record<string, string> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, `bg-${PALETTE[s]}-500/10`]),
);
