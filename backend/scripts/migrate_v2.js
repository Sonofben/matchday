import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key && !key.startsWith('#') && rest.length)
            process.env[key.trim()] = rest.join('=').trim();
    }
}
const db = new Pool({ connectionString: process.env.DATABASE_URL });
async function migrate() {
    console.log('🔄 Running v2 migrations...');
    const schemaPath = join(__dirname, '..', '..', 'docs', 'schema_v2.sql');
    const sql = readFileSync(schemaPath, 'utf8');
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('✅ v2 migrations complete!');
    }
    catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', e.message);
        process.exit(1);
    }
    finally {
        client.release();
        await db.end();
    }
}
migrate();
//# sourceMappingURL=migrate_v2.js.map