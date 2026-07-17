export function diffAuditValues<T extends object>(
  oldEntity: T,
  newEntity: T,
  fields: string[],
): { oldValue: Record<string, unknown>; newValue: Record<string, unknown> } {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  const auditableFields = [...new Set(fields)].filter((f) => f !== 'password');

  for (const field of auditableFields) {
    const prev = oldEntity[field as keyof T] as unknown;
    const next = newEntity[field as keyof T] as unknown;
    if (prev !== next) {
      oldValue[field] = prev;
      newValue[field] = next;
    }
  }

  return { oldValue, newValue };
}
