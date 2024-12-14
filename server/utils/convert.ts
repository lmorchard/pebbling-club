type ConverterFunctions<T> = {
  [K in keyof T]?: (value: any) => T[K];
};

export function convertProperties<T>(
  converters: ConverterFunctions<T>,
  query: Partial<Record<keyof T, any>>,
  defaults: T = {} as T
): T {
  const result = { ...defaults, ...query };
  for (const key in converters) {
    const converter = converters[key];
    if (converter && typeof query[key] !== "undefined") {
      result[key] = converter(query[key]);
    }
  }
  return result;
}
