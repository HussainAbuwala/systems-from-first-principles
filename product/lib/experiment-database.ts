import { env } from "cloudflare:workers";

export const BENCHMARK_DATABASE_SHARDS = 4;

type ExperimentEnvironment = typeof env & {
  DB_SHARD_1?: D1Database;
  DB_SHARD_2?: D1Database;
  DB_SHARD_3?: D1Database;
};

const databases = () => {
  const bindings = env as ExperimentEnvironment;
  return [bindings.DB, bindings.DB_SHARD_1, bindings.DB_SHARD_2, bindings.DB_SHARD_3];
};

export function databaseForShard(shard: number): D1Database | null {
  if (!Number.isInteger(shard) || shard < 0 || shard >= BENCHMARK_DATABASE_SHARDS) return null;
  return databases()[shard] ?? null;
}

export function shardForExperimentId(id: string): number {
  const match = /^s([0-3])_/.exec(id);
  return match ? Number(match[1]) : 0;
}

export function databaseForExperiment(id: string): D1Database | null {
  return databaseForShard(shardForExperimentId(id));
}

export function createExperimentId(shard: number | null): string {
  return shard === null ? crypto.randomUUID() : `s${shard}_${crypto.randomUUID()}`;
}
