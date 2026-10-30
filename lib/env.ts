// Reads a setting from .env.local. Failing loudly here is better than
// connecting with "undefined" and getting a confusing error later.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}
