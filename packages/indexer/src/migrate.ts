import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:vigil@localhost:5432/vigil";

  // Parse connection string to connect to default "postgres" first to verify/create "vigil" database
  const defaultUrl = connectionString.replace(/\/vigil(\?.*)?$/, "/postgres$1");

  console.log("Connecting to default 'postgres' database to verify/create 'vigil'...");
  let client = new Client({ connectionString: defaultUrl });
  await client.connect();

  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname='vigil'");
    if (res.rowCount === 0) {
      console.log("Database 'vigil' does not exist. Creating database...");
      await client.query("CREATE DATABASE vigil");
      console.log("Database 'vigil' created successfully!");
    } else {
      console.log("Database 'vigil' already exists.");
    }
  } catch (err: any) {
    console.error("Error checking/creating database:", err.message);
    throw err;
  } finally {
    await client.end();
  }

  // Connect directly to the newly created "vigil" database
  console.log("\nConnecting to 'vigil' database to run schema migrations...");
  client = new Client({ connectionString });
  await client.connect();

  try {
    const migrationFile = path.resolve(__dirname, "../migrations/001_init.sql");
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found at: ${migrationFile}`);
    }

    let sql = fs.readFileSync(migrationFile, "utf8");

    // Remove the CREATE DATABASE and \c psql meta-commands so pg parser doesn't crash
    sql = sql.replace(/CREATE DATABASE\s+vigil\s*;?/gi, "");
    sql = sql.replace(/\\c\s+vigil\s*;?/gi, "");

    console.log("Running schema migration queries...");
    await client.query(sql);
    console.log("✅ Schema migration completed successfully!");
  } catch (err: any) {
    console.error("❌ Error executing migration queries:", err.message);
    throw err;
  } finally {
    await client.end();
  }
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
