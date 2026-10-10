/** Remove resolved credentials without depending on a vendor's token format. */
export function redactKnownCredentials<T>(value: T, credentials: readonly string[]): T {
  const secrets = [...new Set(credentials.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (secrets.length === 0) return value;
  const replace = (text: string): string => {
    for (const secret of secrets) text = text.split(secret).join("[REDACTED_CREDENTIAL]");
    return text;
  };
  const seen = new WeakMap<object, object>();
  const visit = (input: unknown, depth: number): unknown => {
    if (typeof input === "string") return replace(input);
    if (typeof input === "function") return undefined;
    if (input === null || typeof input !== "object") return input;
    if (depth > 64) return "[REDACTED_DEPTH_LIMIT]";
    const existing = seen.get(input);
    if (existing) return existing;
    if (input instanceof Date) return new Date(input.getTime());
    // Keep Error prototypes and non-enumerable message/cause fields: n8n must
    // still recognise its typed errors, while their serialized details are safe.
    const output = Array.isArray(input) ? [] : input instanceof Error ? Object.create(Object.getPrototypeOf(input)) : {};
    seen.set(input, output);
    for (const key of Reflect.ownKeys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      // Never invoke an upstream accessor while sanitizing a response/error.
      if (!descriptor || !("value" in descriptor)) continue;
      Object.defineProperty(output, typeof key === "string" ? replace(key) : key, {
        ...descriptor,
        value: visit(descriptor.value, depth + 1),
      });
    }
    return output;
  };
  return visit(value, 0) as T;
}
