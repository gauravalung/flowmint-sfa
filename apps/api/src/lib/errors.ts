export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  toBody() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

// Generic auth-failure error used for BOTH "employee code not found" and
// "wrong password" and "account locked" — deliberately indistinguishable.
// See SFA_MVP_Scope_Locked.md: generic responses on login/reset prevent
// account enumeration. Trade-off: a legitimately locked-out salesman also
// sees this generic message rather than a specific "try again later," which
// is a real UX cost accepted for the security benefit at pilot scale.
export function invalidCredentialsError() {
  return new ApiError(401, "AUTH_INVALID_CREDENTIALS", "Invalid employee code or password.");
}

export function invalidOtpError() {
  return new ApiError(400, "OTP_INVALID_OR_EXPIRED", "Invalid or expired OTP.");
}
