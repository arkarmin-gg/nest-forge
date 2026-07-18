const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /token/i,
  /otp/i,
  /secret/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /credential/i,
  /access[_-]?key/i,
  /private[_-]?key/i,
  /sender[_-]?id/i,
];

function isSensitiveAuditField(field: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(field));
}

export function diffAuditValues<T extends object>(
  oldEntity: T,
  newEntity: T,
  fields: string[],
): { oldValue: Record<string, unknown>; newValue: Record<string, unknown> } {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  const auditableFields = [...new Set(fields)].filter(
    (field) => !isSensitiveAuditField(field),
  );

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
