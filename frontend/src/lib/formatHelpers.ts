/**
 * Utility helpers for displaying structured marketing data fields
 * that may be either old-format strings or new-format JSON objects.
 */

/**
 * Extract a display label from a campaign_goal value.
 * Handles both old string format and new { title, content } JSON format.
 */
export function campaignGoalLabel(value: string | Record<string, unknown> | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    if (typeof value.title === "string") return value.title;
    if (typeof value.content === "string") return value.content;
  }
  return "";
}
