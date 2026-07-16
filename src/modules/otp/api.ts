// HTTP/consumer-facing surface for OtpModule — services live here, per the
// two-barrel rule (see ARCHITECTURE.md §5). Module class and domain types
// (OtpPurpose/OtpStatus) live in index.ts.
export { OtpService } from './services/otp.service';
