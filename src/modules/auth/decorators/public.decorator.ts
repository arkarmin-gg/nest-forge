import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/is-public-key.constant';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
