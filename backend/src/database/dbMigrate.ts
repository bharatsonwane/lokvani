import { Umzug } from 'umzug';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { Client } from 'pg';
import db, { schemaNames } from './db';
import logger from '../utils/logger';

// Use process.cwd() for current working directory
const currentDir = process.cwd();

interface MigrationFile {
  name: string;
  version: number;
  fullPath: string;
}

interface AppliedMigration {
  version: string;
  name: string;
  md5: string;
}

class DatabaseMigrationManager {
  /**
   * Calculate MD5 hash of a file
   */
  private async getFileMd5(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Extract version number from migration filename
   */
  private extractVersion(name: string): number | null {
    const match = name.match(/^(\d+)-/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Load TypeScript/JavaScript migration files
   */
  private async loadTypeScriptMigration(filePath: string): Promise<any> {
    try {
      // For TypeScript files, we need to use a different approach
      // Since we're running with ts-node, we can use require() for .ts files
      if (filePath.endsWith('.ts')) {
        // Use require() for TypeScript files when running with ts-node
        const migration = require(filePath);
        return migration;
      } else {
        // For JavaScript files, use dynamic import
        const fileUrl = pathToFileURL(filePath).href;
        const migration = await import(fileUrl);
        return migration;
      }
    } catch (error) {
      logger.error(`Failed to load migration from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Prepare migration directory
   */
  private async getOrCreateMigrationDirectory(
    schemaFolderName: string
  ): Promise<string> {
    const migrationDir = path.join(
      currentDir,
      `src/database/migrations/${schemaFolderName}`
    );

    // 🔧 Ensure migration directory exists
    await fs.mkdir(migrationDir, { recursive: true });

    return migrationDir;
  }

  /**
   * Setup database schema and table and get applied migrations
   */
  private async setupDBSchemaAndGetAppliedMigrations({
    client,
    schemaName,
  }: {
    client: Client;
    schemaName: string;
  }): Promise<AppliedMigration[]> {
    /* Ensure schema exists */
    await client.query(`
        CREATE SCHEMA IF NOT EXISTS ${schemaName};
        SET search_path TO ${schemaName};
      `);

    /* Ensure schema + migration table exists */
    await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          version BIGINT PRIMARY KEY,
          name TEXT NOT NULL,
          md5 TEXT NOT NULL,
          run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

    const { rows: appliedMigrations } = (await client.query(
      `SELECT version, name, md5 FROM migrations ORDER BY version::int`
    )) as { rows: AppliedMigration[] };

    return appliedMigrations;
  }

  /**
   * Get pending migrations
   */
  private async getPendingMigration({
    appliedMigrations,
    migrationDir,
  }: {
    appliedMigrations: AppliedMigration[];
    migrationDir: string;
  }): Promise<MigrationFile[]> {
    const files = await fs.readdir(migrationDir);
    const allMigrations: MigrationFile[] = files
      .filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.sql'))
      .map(name => ({
        name,
        version: this.extractVersion(name),
        fullPath: path.join(migrationDir, name),
      }))
      .filter((m): m is MigrationFile => m.version !== null)
      .sort((a, b) => a.version - b.version);

    const appliedVersions = appliedMigrations.map(r => parseInt(r.version, 10));
    const lastAppliedVersion = appliedVersions.at(-1) ?? 0;
    const expectedNextVersion = lastAppliedVersion + 1;

    const pendingMigrations = allMigrations.filter(
      m => !appliedVersions.includes(m.version)
    );

    // 🚫 Prevent version skipping
    for (let i = 0; i < pendingMigrations.length; i++) {
      const expected = expectedNextVersion + i;
      if (pendingMigrations[i].version !== expected) {
        throw new Error(
          `⛔ Migration version mismatch: expected ${expected}, but got ${pendingMigrations[i].name}`
        );
      }
    }

    return pendingMigrations;
  }

  /**
   * Setup schema and migration table
   */
  private async runMigrationForSchema({
    schemaName,
    schemaFolderName,
  }: {
    schemaName: string;
    schemaFolderName: string;
  }): Promise<void> {
    const client = await db.getDbClient();

    const migrationDir =
      await this.getOrCreateMigrationDirectory(schemaFolderName);

    const appliedMigrations = await this.setupDBSchemaAndGetAppliedMigrations({
      client,
      schemaName,
    });

    const pendingMigrations = await this.getPendingMigration({
      appliedMigrations,
      migrationDir,
    });

    // 🛠 Run migrations using Umzug
    const umzug = new Umzug({
      migrations: pendingMigrations.map(({ name, fullPath }) => ({
        name,
        path: fullPath,
        up: async () => {
          await client.query('BEGIN');
          // 🔐 Wrap each migration file in a transaction
          try {
            if (name.endsWith('.sql')) {
              const sql = await fs.readFile(fullPath, 'utf8');
              await client.query(sql);
            } else {
              // For TypeScript/JavaScript files, use our custom loader
              try {
                const migration = await this.loadTypeScriptMigration(fullPath);
                if (migration.up && typeof migration.up === 'function') {
                  await migration.up(client);
                } else {
                  throw new Error(
                    `Migration file ${name} does not export an 'up' function`
                  );
                }
              } catch (importError) {
                logger.error(
                  `Failed to import migration ${name}:`,
                  importError
                );
                throw new Error(
                  `Failed to import migration ${name}: ${importError}`
                );
              }
            }
            await client.query('COMMIT');
            logger.info(`✅ Applied migration: ${name}`);
          } catch (err) {
            await client.query('ROLLBACK');
            logger.error(`❌ Migration failed and rolled back: ${name}`, err);
            throw err;
          }
        },
      })),
      storage: {
        executed: async () => {
          /** 🔍 Validate MD5 hashes for previously applied migrations */
          for (const row of appliedMigrations) {
            const { version, name: recordedName, md5: recordedMd5 } = row;
            const filePath = path.join(migrationDir, recordedName);
            try {
              const currentMd5 = await this.getFileMd5(filePath);
              if (currentMd5 !== recordedMd5) {
                throw new Error(
                  `❌ MD5 mismatch in ${recordedName}. Was modified after applying.\nExpected: ${recordedMd5}, Found: ${currentMd5}`
                );
              }
            } catch (err: any) {
              if (err.code === 'ENOENT') {
                throw new Error(
                  `❌ Applied migration missing: ${recordedName}`
                );
              }
              throw err;
            }
          }
          return appliedMigrations.map(r => r.name);
        },
        logMigration: async (migration: any) => {
          const { name, path: migrationPath } = migration;
          const version = this.extractVersion(name);
          if (version === null) return;

          const md5 = await this.getFileMd5(migrationPath);
          await client.query(
            `INSERT INTO migrations(version, name, md5) VALUES ($1, $2, $3)`,
            [version, name, md5]
          );
        },
        unlogMigration: async (migrationName: string | { name: string }) => {
          const name =
            typeof migrationName === 'object'
              ? migrationName.name
              : migrationName;
          const version = this.extractVersion(name);
          if (version === null) return;

          await client.query(`DELETE FROM migrations WHERE version = $1`, [
            version.toString(),
          ]);
        },
      },
      logger: {
        info: (msg: any) => logger.info('ℹ️', msg),
        warn: (msg: any) => logger.warn('⚠️', msg),
        error: (msg: any) => logger.error('❌', msg),
        debug: (msg: any) => logger.info('🔍', msg),
      },
    });

    await umzug.up();
    await client.query('COMMIT');
    await client.query(`RESET search_path`);
    logger.info(`✅ Migrations completed for schema: ${schemaName}`);
  }

  public async handleMigration(): Promise<void> {
    try {
      await this.runMigrationForSchema({
        schemaName: schemaNames.main,
        schemaFolderName: schemaNames.main,
      });

      const client = await db.getDbClient();

      /*
      const { rows: tenants } = await client.query(
        `SELECT id, name FROM ${schemaNames.main}.tenants`
      );
      for (const tenant of tenants) {
        const schemaName = schemaNames.tenantSchemaName(tenant.id);
        logger.info(`ℹ️ Running migration for: ${tenant.name} (${schemaName})`);
        try {
          await this.runMigrationForSchema({
            schemaName: schemaName,
            schemaFolderName: schemaNames.tenantSchemaFolderName(tenant.id),
          });
        } catch (err) {
          logger.error(
            `❌ Failed to migrate ${tenant.name} (${schemaName}). Skipping.`
          );
        }
      }
      */
      await db.shutdown();
      logger.info('✅ All migrations completed');
    } catch (error) {
      logger.error('❌ Migration process failed:', error);
    }
  }
}

const main = async (): Promise<void> => {
  try {
    const migrationManager = new DatabaseMigrationManager();
    await migrationManager.handleMigration();
  } catch (error) {
    logger.error('Fatal error in main function:', error);
    process.exit(1);
  } finally {
    logger.info('Migration script exiting...');
    process.exit();
  }
};

main();
