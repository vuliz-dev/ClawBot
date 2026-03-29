// Escape text for Telegram MarkdownV2
const SPECIAL_CHARS = /[_*[\]()~`>#+\-=|{}.!\\]/g;

export function escapeMarkdownV2(text: string): string {
  return text.replace(SPECIAL_CHARS, (c) => `\\${c}`);
}

// Simple conversion: preserve code blocks, escape everything else
export function formatForTelegram(text: string): string {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // code block — keep as-is
      return escapeMarkdownV2(part);
    })
    .join("");
}
