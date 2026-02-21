/**
 * Svelte action for auto-scrolling a container to the bottom.
 *
 * When enabled, keeps the container scrolled to the bottom as new content
 * is added. Uses a MutationObserver to detect content changes.
 */
export function autoScroll(node: HTMLElement, enabled: boolean) {
  let isEnabled = enabled;
  let observer: MutationObserver | null = null;

  function scrollToBottom() {
    if (isEnabled) {
      node.scrollTop = node.scrollHeight;
    }
  }

  function setupObserver() {
    observer = new MutationObserver(() => {
      scrollToBottom();
    });
    observer.observe(node, { childList: true, subtree: true });
  }

  // Initial scroll if enabled
  scrollToBottom();
  setupObserver();

  return {
    update(newEnabled: boolean) {
      isEnabled = newEnabled;
      if (isEnabled) {
        scrollToBottom();
      }
    },
    destroy() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    },
  };
}
