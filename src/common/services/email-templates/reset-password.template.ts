export function resetPasswordEmailTemplate({
  code,
  userName,
  fromUsername,
  expiresIn,
}: {
  code: string;
  userName: string;
  fromUsername: string;
  expiresIn: number;
}): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Code</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #d9534f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
      .code-box { background: #fff; border: 2px solid #d9534f; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
      .code { font-size: 32px; font-weight: bold; color: #d9534f; letter-spacing: 5px; }
      .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0; }
      .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      .button { display: inline-block; padding: 12px 24px; background: #d9534f; color: white; text-decoration: none; border-radius: 4px; margin: 15px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔒 Password Reset Request</h1>
      </div>
      <div class="content">
        <h2>Hello ${userName},</h2>
        <p>We received a request to reset your password for your account. Please use the verification code below to reset your password:</p>

        <div class="code-box">
          <div class="code">${code}</div>
        </div>

        <div class="warning">
          <strong>⚠️ Important Security Notice:</strong>
          <ul>
            <li>This code will expire in ${expiresIn} minutes</li>
            <li>Do not share this code with anyone</li>
            <li>If you didn't request a password reset, please ignore this email and contact your administrator immediately</li>
            <li>Your account security is important to us</li>
          </ul>
        </div>

        <p>Enter this code in the password reset page to create a new password for your account.</p>

        <p>If you have any questions or need assistance, please contact our support team.</p>

        <p>Best regards,<br>
        <strong>${fromUsername}</strong></p>
      </div>
      <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>For security reasons, this code can only be used once and will expire shortly.</p>
      </div>
    </div>
  </body>
  </html>
`;
}
