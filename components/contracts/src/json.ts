export type JsonPrimitive = null | boolean | number | string
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue }

export function isJsonValue(value: unknown): value is JsonValue {
  try {
    return isJsonValueInner(value, new Set<object>())
  } catch {
    return false
  }
}

function isJsonValueInner(value: unknown, ancestors: Set<object>): value is JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return true
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
  }
  if (typeof value !== "object") return false
  if (ancestors.has(value)) return false

  ancestors.add(value)
  let result: boolean
  if (Array.isArray(value)) {
    result = value.every((candidate) => isJsonValueInner(candidate, ancestors))
  } else {
    const prototype = Object.getPrototypeOf(value)
    result =
      (prototype === Object.prototype || prototype === null) &&
      Object.values(value).every((candidate) => isJsonValueInner(candidate, ancestors))
  }
  ancestors.delete(value)
  return result
}

export function cloneJsonValue(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map((candidate) => cloneJsonValue(candidate))
  const output = Object.create(null) as Record<string, JsonValue>
  for (const [key, candidate] of Object.entries(value)) {
    output[key] = cloneJsonValue(candidate)
  }
  return output
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

export function hasOnlyKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
): boolean {
  try {
    return Object.keys(value).every((key) => allowed.has(key))
  } catch {
    return false
  }
}
