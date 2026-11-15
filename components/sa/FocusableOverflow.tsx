'use client';

import { useEffect } from 'react';

/**
 * Makes sideways-scrolling blocks reachable from the keyboard.
 *
 * A <pre> that scrolls horizontally must be focusable, or a keyboard user cannot read
 * the part that is cut off (axe rule scrollable-region-focusable, serious). Adding a tab
 * stop to every <pre> would be noise, because most code fits. So this adds
 * tabindex="0", a role and a label only while a block actually overflows, and removes
 * them again when it stops overflowing (a wider window, a rotated phone).
 *
 * Put one instance on a page and point it at a container with `selector`.
 */
export function FocusableOverflow({ root = '.sa-prose', label = 'Code, scrolls sideways' }: { root?: string; label?: string }) {
  useEffect(() => {
    const container = document.querySelector(root);
    if (!container) return;
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('pre'));

    const update = (el: HTMLElement) => {
      const overflows = el.scrollWidth > el.clientWidth + 1;
      if (overflows) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', label);
        el.setAttribute('data-scroll-region', '');
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
        el.removeAttribute('aria-label');
        el.removeAttribute('data-scroll-region');
      }
    };

    const updateAll = () => blocks.forEach(update);
    updateAll();
    // The box does not resize when a web font replaces the fallback, but the text inside
    // does, so a ResizeObserver alone misses it. Check again once fonts and the page have loaded.
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) updateAll();
    });
    window.addEventListener('load', updateAll);
    window.addEventListener('resize', updateAll);
    const observer = new ResizeObserver(updateAll);
    blocks.forEach((b) => observer.observe(b));
    return () => {
      active = false;
      window.removeEventListener('load', updateAll);
      window.removeEventListener('resize', updateAll);
      observer.disconnect();
    };
  }, [root, label]);

  return null;
}
