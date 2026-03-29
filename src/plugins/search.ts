// web_search tool — tìm kiếm web qua DuckDuckGo (không cần API key)

const SEARCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Tìm kiếm web qua DuckDuckGo HTML endpoint.
 * Không cần API key.
 */
export async function webSearch(query: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const encoded = encodeURIComponent(query);
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
        "Accept": "text/html",
        "Accept-Language": "vi,en;q=0.9",
      },
    });

    if (!resp.ok) {
      return `Search error: HTTP ${resp.status}`;
    }

    const html = await resp.text();
    const results = parseDDGResults(html);

    if (results.length === 0) {
      return `Không tìm thấy kết quả nào cho: "${query}"`;
    }

    const lines = [`Kết quả tìm kiếm cho: "${query}"\n`];
    for (const [i, r] of results.entries()) {
      lines.push(`${i + 1}. **${r.title}**`);
      lines.push(`   ${r.url}`);
      if (r.snippet) lines.push(`   ${r.snippet}`);
      lines.push("");
    }

    return lines.join("\n");
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return `Search timed out after ${SEARCH_TIMEOUT_MS / 1000}s`;
    }
    return `Search error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    clearTimeout(timer);
  }
}

function parseDDGResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo HTML results are in <div class="result"> blocks
  // Extract title, URL, snippet using regex (no DOM parser in Node)
  const resultBlocks = html.match(/<div class="result[^"]*"[\s\S]*?(?=<div class="result[^"]*"|<div id="links_wrapper")/g) ?? [];

  for (const block of resultBlocks.slice(0, MAX_RESULTS)) {
    // Title: inside <a class="result__a" ...>...</a>
    const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
    const title = titleMatch ? stripTags(titleMatch[1]).trim() : "";

    // URL: href in result__a
    const urlMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/i);
    let url = urlMatch ? urlMatch[1] : "";

    // DuckDuckGo wraps URLs in /l/?kh=-1&uddg=...
    if (url.includes("uddg=")) {
      try {
        const m = url.match(/uddg=([^&]+)/);
        if (m) url = decodeURIComponent(m[1]);
      } catch {
        // keep as-is
      }
    }

    // Snippet: inside <a class="result__snippet">
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]).trim() : "";

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
}
