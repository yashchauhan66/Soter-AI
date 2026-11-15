'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Accessible tabs following the WAI-ARIA tabs pattern.
 * Keyboard: Left/Right (and Up/Down) move and select, Home/End jump, Tab moves
 * into the panel. Only the selected tab is in the tab order.
 * Every panel stays in the DOM and is hidden with the `hidden` attribute, so the
 * content is present for crawlers and assistive tech and does not remount.
 */
export function Tabs({
  items,
  label,
  initial,
}: {
  items: TabItem[];
  label: string;
  initial?: string;
}) {
  const base = useId();
  const [selected, setSelected] = useState(initial ?? items[0]?.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function move(toIndex: number) {
    const next = items[(toIndex + items.length) % items.length];
    setSelected(next.id);
    refs.current[next.id]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        move(0);
        break;
      case 'End':
        event.preventDefault();
        move(items.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div>
      <div className="sa-tablist" role="tablist" aria-label={label}>
        {items.map((item, i) => {
          const isSelected = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[item.id] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              className="sa-tab"
              onClick={() => setSelected(item.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={item.id !== selected}
          className="sa-tabpanel"
          tabIndex={0}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
