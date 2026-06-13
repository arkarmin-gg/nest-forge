import { SetMetadata } from '@nestjs/common';

export const SUBJECT_KEY = 'subjectType';

export type RequiredSubjectType = 'USER' | 'ADMIN';

// Restricts a handler/controller to a single Subject type (see CONTEXT.md → Subject).
// Used to keep the app zone (USER) and admin zone (ADMIN) surfaces from overlapping:
// the global JwtAuthGuard only proves a token is valid — this asserts which kind.
// See SubjectGuard for enforcement.
export const RequireSubject = (subjectType: RequiredSubjectType) =>
  SetMetadata(SUBJECT_KEY, subjectType);
