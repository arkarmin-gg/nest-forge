import { SetMetadata } from '@nestjs/common';
import { CHECK_OWNERSHIP_KEY } from '../constants/check-ownership-key.constant';

/** @lintignore Public decorator documented in ARCHITECTURE.md; used by downstream controllers when ownership checks are needed. */
export const CheckOwnership = () => SetMetadata(CHECK_OWNERSHIP_KEY, true);
