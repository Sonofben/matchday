/**
 * Migration script — run with: npm run db:migrate
 * Reads docs/schema.sql and applies it to the database.
 * Safe to re-run: uses IF NOT EXISTS / ON CONFLICT throughout.
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Pool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/matchday',
});
async function migrate() {
    console.log('🔄 Running MatchDay migrations...');
    // Path: backend/scripts/migrate.ts → up two levels → docs/schema.sql
    const schemaPath = join(__dirname, '..', '..', 'docs', 'schema.sql');
    let sql;
    try {
        sql = readFileSync(schemaPath, 'utf8');
    }
    catch {
        console.error(`❌ Could not read schema file at: ${schemaPath}`);
        console.error('   Make sure docs/schema.sql exists (it ships with the project).');
        process.exit(1);
    }
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('✅ Migrations complete — all tables, enums, indexes, and triggers created.');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
    finally {
        client.release();
        await db.end();
    }
}
migrate();
//# sourceMappingURL=migrate.js.map