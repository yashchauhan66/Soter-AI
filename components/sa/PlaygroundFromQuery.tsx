'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Playground } from './Playground';
import { ALL_PRESETS } from '@/lib/sa/presets';

/**
 * Reads `?preset=<id>` and starts the playground with that example loaded, so a
 * page that explains an attack can link straight to it, for example
 * `/playground?preset=rag-poisoning`.
 *
 * Reading the query in a client component, inside Suspense, keeps /playground
 * statically rendered. The server HTML holds the empty playground, and the
 * browser swaps in the chosen example after hydration. An unknown id is ignored.
 * The example only fills the text box; nothing is sent until the visitor presses
 * "Check this text".
 */
function FromQuery() {
  const id = useSearchParams().get('preset') ?? undefined;
  const known = ALL_PRESETS.some((p) => p.id === id) ? id : undefined;
  // `key` remounts the playground when the id changes, so its initial state is applied.
  return <Playground key={known ?? 'none'} initialPresetId={known} />;
}

export function PlaygroundFromQuery() {
  return (
    <Suspense fallback={<Playground />}>
      <FromQuery />
    </Suspense>
  );
}
