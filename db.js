import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// DATABASE_URL kommt aus Render Environment Variables (nie im Code!)
// Beispiel: postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon erfordert SSL
});

export async function query(text, params) {
  return pool.query(text, params);
}
