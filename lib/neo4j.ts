// Neo4j driver, shared by every API route (server only).
import "server-only";
import neo4j, { Driver } from "neo4j-driver";
import { requireEnv } from "./env";

function createDriver() {
  return neo4j.driver(
    requireEnv("NEO4J_URI"),
    neo4j.auth.basic(requireEnv("NEO4J_USERNAME"), requireEnv("NEO4J_PASSWORD")),
    // Neo4j integers are 64-bit; our counts are small, so plain JS numbers are fine.
    { disableLosslessIntegers: true },
  );
}

// Same reason as in db.ts: one driver for the whole app, even across dev reloads.
const globalForNeo4j = globalThis as unknown as { neo4jDriver?: Driver };
export const driver = globalForNeo4j.neo4jDriver ?? createDriver();
if (process.env.NODE_ENV !== "production") globalForNeo4j.neo4jDriver = driver;

// Runs one Cypher statement and returns each record as a plain object.
// Values are passed as $parameters, never pasted into the Cypher text.
export async function runCypher<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const { records } = await driver.executeQuery(cypher, params, {
    database: process.env.NEO4J_DATABASE || undefined,
  });
  return records.map((r) => r.toObject() as T);
}

// Aura Free pauses after a few idle days; say so instead of showing a raw socket error.
export const NEO4J_PAUSED_HINT =
  "Could not reach Neo4j. If the Aura instance is paused, log in at console.neo4j.io and press Resume.";
