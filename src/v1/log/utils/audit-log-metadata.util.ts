export interface AuditLogMetadata {
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export const AUDIT_LOG_METADATA = '__auditLogMetadata';

export type AuditableResult = object & {
  [AUDIT_LOG_METADATA]?: AuditLogMetadata;
};

export function attachAuditLogMetadata<T extends object>(
  result: T,
  metadata: AuditLogMetadata,
): T {
  Object.defineProperty(result, AUDIT_LOG_METADATA, {
    value: metadata,
    enumerable: true,
    configurable: true,
  });

  return result;
}

export function consumeAuditLogMetadata(result: unknown): AuditLogMetadata {
  if (!result || typeof result !== 'object') return {};

  const auditableResult = result as AuditableResult;
  const metadata = auditableResult[AUDIT_LOG_METADATA] ?? {};

  delete auditableResult[AUDIT_LOG_METADATA];

  return metadata;
}

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
