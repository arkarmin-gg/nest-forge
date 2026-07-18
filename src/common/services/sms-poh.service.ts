import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  DEFAULT_MOCK_OTP_CODE,
  getMockOtpCode,
  isOtpMockEnabled,
  nowIso,
} from '../utils';

@Injectable()
export class SMSPohService {
  private readonly apiBase: string;
  private readonly accessToken: string;
  private readonly brand: string;
  private readonly fromName: string;
  private readonly enabled: boolean;
  private readonly mockEnabled: boolean;
  private readonly mockOtp: string;

  /** Mock request ID used when OTP mocks are enabled. */
  static readonly MOCK_OTP = DEFAULT_MOCK_OTP_CODE;
  static readonly MOCK_REQUEST_ID = DEFAULT_MOCK_OTP_CODE;

  constructor(private readonly config: ConfigService) {
    this.mockEnabled = isOtpMockEnabled(config);
    this.mockOtp = getMockOtpCode(config);

    if (this.mockEnabled) {
      this.enabled = false;
      this.accessToken = '';
      this.apiBase = '';
      this.brand = 'mock';
      this.fromName = 'mock';
      return;
    }

    const providerEnabled = this.config.getOrThrow<boolean>('sms.poh.enabled');
    this.apiBase = this.config.get<string>('sms.poh.baseApiUrl') || '';
    this.brand = this.config.get<string>('sms.poh.brand') || 'SMSPoh';
    this.fromName = this.config.get<string>('sms.poh.senderId') || this.brand;

    if (!providerEnabled) {
      this.enabled = false;
      this.accessToken = '';
      return;
    }

    const key = this.config.get<string>('sms.poh.apiKey');
    const secret = this.config.get<string>('sms.poh.apiSecretKey');
    if (!key || !secret || !this.apiBase) {
      throw new InternalServerErrorException(
        'SMS provider configuration missing',
      );
    }
    this.enabled = true;
    this.accessToken = Buffer.from(`${key}:${secret}`).toString('base64');
  }

  async sendOTP(params: {
    to: string;
    message: string;
    ttl?: number;
    pinLength?: number;
    brand?: string;
    from?: string;
  }): Promise<{
    success: boolean;
    requestId: string;
  }> {
    if (this.mockEnabled) {
      return {
        success: true,
        requestId: SMSPohService.MOCK_REQUEST_ID,
      };
    }

    if (!this.enabled) {
      throw new InternalServerErrorException('SMS provider is not configured');
    }
    const { to, message } = params;
    const ttl = params.ttl ?? 300;
    const pinLength = params.pinLength ?? 6;
    const fromName = encodeURIComponent(this.fromName);
    const brand = encodeURIComponent(this.brand);
    const encodedTo = encodeURIComponent(to);
    const encodedMessage = encodeURIComponent(message);

    const url = `${this.apiBase}/otp/request?accessToken=${this.accessToken}&from=${fromName}&to=${encodedTo}&brand=${brand}&ttl=${ttl}&pinLength=${pinLength}&template=${encodedMessage}`;

    try {
      const res = await axios.post(url, {});
      const data = res.data;
      if (!data?.requestId) {
        throw new InternalServerErrorException('Invalid SMS provider response');
      }
      return { success: true, requestId: data.requestId };
    } catch (e: any) {
      const text = e?.response?.data;
      throw new InternalServerErrorException(
        typeof text === 'string' ? text : 'Error when sending SMS',
      );
    }
  }

  async verifyOTP(params: { requestId: string; code: string }) {
    if (this.mockEnabled) {
      const isValid =
        params.requestId === SMSPohService.MOCK_REQUEST_ID &&
        params.code === this.mockOtp;
      if (!isValid) {
        throw new BadRequestException('Invalid OTP or request ID');
      }
      return {
        success: true,
        verifiedAt: nowIso(),
        to: 'mock',
      };
    }

    if (!this.enabled) {
      throw new InternalServerErrorException('SMS provider is not configured');
    }
    const { requestId, code } = params;
    const encodedCode = encodeURIComponent(code);
    const url = `${this.apiBase}/otp/verify?requestId=${requestId}&code=${encodedCode}&accessToken=${this.accessToken}`;

    try {
      const res = await axios.post(url, {});
      const data = res.data;
      if (!data?.verifiedAt) {
        throw new BadRequestException('Invalid OTP or request ID');
      }
      return { success: true, verifiedAt: data.verifiedAt, to: data.to };
    } catch (e: any) {
      const text = e?.response?.data;
      throw new BadRequestException(
        typeof text === 'string' ? text : 'Invalid OTP or request ID',
      );
    }
  }
}
