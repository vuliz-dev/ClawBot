// fetch_url tool — lấy nội dung text từ một URL

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_LENGTH = 8_000; // chars trả về cho AI

/**
 * Fetch URL và trả về nội dung text (stripped HTML).
 */
export async function fetchUrl(url: string): Promise<string> {
  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Error: Invalid URL "${url}"`;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return `Error: Only http/https URLs are supported.`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClawBot/1.0)",
        "Accept": "text/html,text/plain,application/json",
      },
    });

    if (!resp.ok) {
      return `Error: HTTP ${resp.status} ${resp.statusText}`;
    }

    const contentType = resp.headers.get("content-type") ?? "";
    const text = await resp.text();

    // If JSON, return as-is (truncated)
    if (contentType.includes("application/json")) {
      return text.length > MAX_CONTENT_LENGTH
        ? text.slice(0, MAX_CONTENT_LENGTH) + "\n...(truncated)"
        : text;
    }

    // Strip HTML tags
    const stripped = stripHtml(text);

    return stripped.length > MAX_CONTENT_LENGTH
      ? stripped.slice(0, MAX_CONTENT_LENGTH) + "\n...(truncated)"
      : stripped;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return `Error: Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
    }
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Replace block-level tags with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br|article|section|header|footer|nav|main)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
