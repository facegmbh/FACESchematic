import { useEffect, useRef } from "react";

/**
 * Close a context menu on the next click, right-click or Escape anywhere.
 *
 * The listeners are registered once, on mount. That matters more than it looks: the obvious
 * version puts `onClose` in the effect's dependencies, and a caller that passes an inline
 * arrow — `onClose={() => setMenu(null)}` — hands over a new function on every render. The
 * effect then tears the listeners down and schedules them again a tick later, over and over,
 * and a click landing in one of those gaps does nothing. That is exactly how a menu ends up
 * refusing to go away.
 *
 * The one-tick delay before arming is still needed: the very click that opened the menu is
 * still travelling up the tree, and arming synchronously would close the menu with it.
 */
export function useDismissMenu(onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const dismiss = () => close.current();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    const timer = setTimeout(() => {
      document.addEventListener("click", dismiss);
      document.addEventListener("contextmenu", dismiss);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", dismiss);
      document.removeEventListener("contextmenu", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
}
