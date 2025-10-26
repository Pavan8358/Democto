import { createHash, randomBytes } from "crypto";

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateSessionSecret(): { secret: string; hash: string } {
  const secret = randomBytes(24).toString("hex");
  return {
    secret,
    hash: hashString(secret)
  };
}
