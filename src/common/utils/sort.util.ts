export function resolveSortField<T extends string>(
  sortBy: string | undefined,
  validFields: readonly T[],
  defaultField: T,
): T {
  return validFields.includes(sortBy as T) ? (sortBy as T) : defaultField;
}
