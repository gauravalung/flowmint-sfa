import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",
  },
  resetTokenSecret: required("RESET_TOKEN_SECRET"),
  verificationTokenSecret: required("VERIFICATION_TOKEN_SECRET"),
  otp: {
    provider: process.env.OTP_PROVIDER ?? "console",
    msg91ApiKey: process.env.MSG91_API_KEY ?? "",
    msg91SenderId: process.env.MSG91_SENDER_ID ?? "",
  },
};
