export interface OTPRecord {
  otp: string;
  expiresAt: number;
}

export interface OTPGenerateResponse {
  otp: string;
  expirationTime: number;
}

export interface OTPVerifyRequest {
  clientId: string;
  otp: string;
}
