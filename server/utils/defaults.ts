import { isEqual } from "./compare";

export function stripDefaults<T extends Record<string, any>>(
  options: T,
  defaults: T
): T {
  return Object.fromEntries(
    Object.entries(options).filter(
      ([key, value]) =>
        typeof value !== "undefined" && !isEqual(value, defaults[key])
    )
  ) as T;
}

export function stripUndefined<T extends Record<string, any>>(options: T): T {
  return Object.fromEntries(
    Object.entries(options).filter(([_, value]) => typeof value !== "undefined")
  ) as T;
}
