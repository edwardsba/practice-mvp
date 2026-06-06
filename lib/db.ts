import "server-only"

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined
}

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool
}

export const db = drizzle(pool)
