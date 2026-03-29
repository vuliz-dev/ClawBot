/**
 * Tracks active AI streams keyed by chatId so /stop can cancel them.
 */
const activeStreams = new Map<string, AbortController>();

export function registerStream(chatId: string): AbortController {
  cancelStream(chatId); // cancel any existing stream for this chat
  const controller = new AbortController();
  activeStreams.set(chatId, controller);
  return controller;
}

export function cancelStream(chatId: string): boolean {
  const controller = activeStreams.get(chatId);
  if (controller) {
    controller.abort();
    activeStreams.delete(chatId);
    return true;
  }
  return false;
}

export function deregisterStream(chatId: string): void {
  activeStreams.delete(chatId);
}
