import { NextResponse } from "next/server";
import { checkRedisHealth } from "@/lib/cache";

const BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://localhost:8000";

export async function GET() {
  const [redis, backend] = await Promise.allSettled([
    checkRedisHealth(),
    fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok),
  ]);

  const redisOk = redis.status === "fulfilled" && redis.value;
  const backendOk = backend.status === "fulfilled" && backend.value;

  return NextResponse.json({
    status: redisOk && backendOk ? "ok" : "degraded",
    redis: redisOk,
    backend: backendOk,
    timestamp: new Date().toISOString(),
  }, { status: redisOk && backendOk ? 200 : 503 });
}
