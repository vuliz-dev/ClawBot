export async function getWeather(location: string): Promise<string> {
  try {
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=3`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "curl/7.68.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return `Could not fetch weather for "${location}"`;
    const text = await resp.text();
    return text.trim();
  } catch {
    return `Could not fetch weather for "${location}"`;
  }
}
