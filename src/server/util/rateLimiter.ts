export class RateLimiter {
  private readonly buckets = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly intervalMs: number) {}

  consume(key: string): void {
    const now = Date.now();
    const windowStart = now - this.intervalMs;
    const bucket = this.buckets.get(key) ?? [];
    const filtered = bucket.filter((timestamp) => timestamp >= windowStart);
    if (filtered.length >= this.limit) {
      throw new Error("Rate limit exceeded");
    }
    filtered.push(now);
    this.buckets.set(key, filtered);
  }
}
