import type { IDataObject, IExecuteFunctions } from "n8n-workflow";

import { placementOf } from "./layoutV3";
import { V3_OPTION_DEFAULTS } from "./propertiesV3";

/**
 * Lets version 3's panel drive the version-2 engine without forking it.
 *
 * `execute.ts` is ~3,600 lines and holds every security decision this node
 * makes. Copying it so the copy could say `operation` instead of `action` would
 * mean two places to fix a detection bug and, eventually, two different answers
 * to the same input — the worst possible outcome for a guard. So the engine is
 * left alone and the *reads* are redirected: this wrapper answers
 * `getNodeParameter` from wherever the version-3 layout actually stored the
 * value, and everything downstream is unchanged.
 *
 * Three redirections, all driven by `layoutV3.ts`:
 *
 *   `action`                -> the `operation` parameter, same twelve values.
 *   `advancedOptions`,      -> the whole `options` collection. Version 2 had two
 *   `advancedDetection`        collections; version 3 has one, and both reads
 *                              want "the bag of optional settings".
 *   anything else           -> panel, inside `options`, or not on this operation
 *                              at all, per `placementOf`.
 *
 * The part that is easy to get wrong, and the reason this file exists rather
 * than a few inline `??`s: **an option nobody set resolves to the node's
 * default, not to the fallback the caller passed.** n8n fills defaults for
 * top-level fields but stores a collection as only the keys the author touched,
 * so a naive read hands `execute.ts` its own fallback instead. Those fallbacks
 * were written for a panel where n8n supplied the default, and one of them
 * disagrees: Detection Engine is `AUTO` on the node and `"CLOUD"` at the call
 * site. Reading it naively would leave every author who never opened Options
 * running Cloud Only — no local fallback, so a brief API outage becomes a
 * stopped workflow, silently, on the security node. `V3_OPTION_DEFAULTS` is
 * consulted first for exactly this reason.
 */

/** Version-2 collection names that both mean "the optional settings" in version 3. */
const COLLECTION_ALIASES = new Set(["advancedOptions", "advancedDetection"]);

type RawGetter = (...args: unknown[]) => unknown;

export function withV3ParameterLayout(ctx: IExecuteFunctions): IExecuteFunctions {
  const read = ctx.getNodeParameter.bind(ctx) as RawGetter;

  // `operation` is noDataExpression and always has a default, so this read
  // cannot fail on a well-formed node; no fallback is passed on purpose, so a
  // malformed one surfaces instead of quietly resolving every field to "absent".
  const operationAt = (itemIndex: number) => String(read("operation", itemIndex));
  const optionsAt = (itemIndex: number) => (read("options", itemIndex, {}) ?? {}) as IDataObject;

  const getNodeParameter = function (...args: unknown[]): unknown {
    const name = args[0] as string;
    const itemIndex = args[1] as number;

    if (name === "action") return read("operation", ...args.slice(1));
    if (COLLECTION_ALIASES.has(name)) return optionsAt(itemIndex);

    const placement = placementOf(operationAt(itemIndex), name);

    // On the panel: n8n resolves it exactly as it did for version 2, including
    // expressions, `extractValue`, and the caller's own fallback.
    if (placement === "panel") return read(...args);

    if (placement === "options") {
      const value = optionsAt(itemIndex)[name];
      if (value !== undefined) return value;
      if (name in V3_OPTION_DEFAULTS) return V3_OPTION_DEFAULTS[name];
      return args.length > 2 ? args[2] : undefined;
    }

    // Not offered by this operation. Version 2 hid the field, and a hidden n8n
    // parameter resolves to the caller's fallback, so returning it reproduces
    // version 2 exactly. A read with no fallback would have thrown there too,
    // and it throws here rather than returning `undefined`: it can only mean the
    // layout and the engine disagree about what an operation needs, and a guard
    // is not the place to guess.
    if (args.length > 2) return args[2];
    throw new Error(
      `SoterAI v3 layout: "${name}" is not offered by operation "${operationAt(itemIndex)}" and was read without a fallback.`,
    );
  } as unknown as IExecuteFunctions["getNodeParameter"];

  return new Proxy(ctx, {
    get(target, property) {
      if (property === "getNodeParameter") return getNodeParameter;
      // Read against the real context, not the proxy: a getter invoked with the
      // proxy as its receiver would re-enter this trap for everything it touches.
      const value = Reflect.get(target, property, target);
      // Methods are bound for the same reason — n8n's implementations reach for
      // their own private state through `this`.
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}
