import { SetMetadata } from '@nestjs/common';
import { CHECK_OWNERSHIP_KEY } from '../constants/check-ownership-key.constant';

export const CheckOwnership = () => SetMetadata(CHECK_OWNERSHIP_KEY, true);
