import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHello() {
    return {
      message: `${this.configService.get<string>('APP_NAME')}! Have a good day my friend 😊.`,
      timestamp: new Date(),
    };
  }
}
