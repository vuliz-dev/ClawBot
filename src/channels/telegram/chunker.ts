const MAX_LENGTH = 4000; // Telegram limit is 4096, keep buffer

export function chunkText(text: string): string[] {
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at newline near the limit
    let splitAt = remaining.lastIndexOf("\n", MAX_LENGTH);
    if (splitAt < MAX_LENGTH / 2) {
      // No good newline, split at space
      splitAt = remaining.lastIndexOf(" ", MAX_LENGTH);
    }
    if (splitAt < MAX_LENGTH / 2) {
      // No good space either, hard split
      splitAt = MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks.filter((c) => c.length > 0);
}
