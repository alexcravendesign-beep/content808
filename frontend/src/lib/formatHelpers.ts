/**
 * Utility helpers for displaying structured marketing data fields
 * that may be either old-format strings, JSON strings, or objects.
 */

/** Try to parse a value that may be a JSON string, an object, or a plain string */
function tryParseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { return JSON.parse(trimmed); } catch { /* not valid JSON */ }
    }
  }
  return value;
}

/**
 * Extract a display label from a campaign_goal value.
 * Handles old string format, JSON strings, and { title, content } objects.
 */
export function campaignGoalLabel(value: string | Record<string, unknown> | null | undefined): string {
  if (!value) return "";

  const parsed = tryParseJson(value);

  // Skip corrupted "[object Object]" strings
  if (typeof parsed === "string") {
    return parsed === "[object Object]" ? "" : parsed;
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.title === "string") return obj.title;
    if (typeof obj.content === "string") return obj.content;
  }
  return "";
}
