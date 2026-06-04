import { SetMetadata } from '@nestjs/common';

export const CHECK_OWNERSHIP_KEY = 'check_ownership';
export const CheckOwnership = () => SetMetadata(CHECK_OWNERSHIP_KEY, true);
