import {
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'node:fs';
import * as sqlite3 from 'sqlite3';
import {
  ensureApplicationDirectories,
  resolveDatabasePath,
} from '../common/utils/app-paths.util';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "user" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      verified_at TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      captured_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE SET NULL
    );`,
  `CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      short_description TEXT NOT NULL,
      image TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS user_menu_items (
      id TEXT PRIMARY KEY NOT NULL,
      item_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS menu_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      scan_photo TEXT NOT NULL,
      captured_at TEXT NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS item_components (
      id TEXT PRIMARY KEY NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      summary TEXT NOT NULL,
      row_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
    );`,
  `CREATE TABLE IF NOT EXISTS ingredient_details (
      id TEXT PRIMARY KEY NOT NULL,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      detail TEXT NOT NULL,
      row_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE
    );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_menu_items_item_user
      ON user_menu_items (item_id, user_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_item_components_item_name
      ON item_components (item_id, name COLLATE NOCASE);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_details_item_name
      ON ingredient_details (item_id, name COLLATE NOCASE);`,
];

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: sqlite3.Database | null = null;

  async onModuleInit(): Promise<void> {
    ensureApplicationDirectories();
    this.cleanupFailedDatabaseArtifacts();

    await new Promise<void>((resolve, reject) => {
      const database = new sqlite3.Database(
        resolveDatabasePath(),
        (error: Error | null) => {
          if (error) {
            reject(error);
            return;
          }

          this.db = database;
          resolve();
        },
      );
    });

    await this.run('PRAGMA journal_mode = MEMORY;');
    await this.run('PRAGMA synchronous = NORMAL;');
    await this.run('PRAGMA foreign_keys = ON;');

    for (const statement of SCHEMA_STATEMENTS) {
      await this.run(statement);
    }

    await this.migrateMenuItemsImageToNullable();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.db) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.db?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async run(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ lastID: number; changes: number }> {
    const database = this.getDatabase();

    return new Promise<{ lastID: number; changes: number }>((resolve, reject) => {
      database.run(sql, params, function handleRun(error: Error | null) {
        if (error) {
          reject(error);
          return;
        }

        const result = this as sqlite3.RunResult;
        resolve({
          lastID: result.lastID ?? 0,
          changes: result.changes ?? 0,
        });
      });
    }).catch((error: Error) => {
      throw new InternalServerErrorException(error.message);
    });
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const database = this.getDatabase();

    return new Promise<T | undefined>((resolve, reject) => {
      database.get(sql, params, (error: Error | null, row: T | undefined) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(row);
      });
    }).catch((error: Error) => {
      throw new InternalServerErrorException(error.message);
    });
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const database = this.getDatabase();

    return new Promise<T[]>((resolve, reject) => {
      database.all(sql, params, (error: Error | null, rows: T[]) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(rows);
      });
    }).catch((error: Error) => {
      throw new InternalServerErrorException(error.message);
    });
  }

  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    await this.run('BEGIN IMMEDIATE TRANSACTION;');

    try {
      const result = await work();
      await this.run('COMMIT;');
      return result;
    } catch (error) {
      await this.run('ROLLBACK;');
      throw error;
    }
  }

  private getDatabase(): sqlite3.Database {
    if (!this.db) {
      throw new InternalServerErrorException(
        'Database connection has not been initialized.',
      );
    }

    return this.db;
  }

  private cleanupFailedDatabaseArtifacts(): void {
    const databasePath = resolveDatabasePath();
    const journalPath = `${databasePath}-journal`;

    if (fs.existsSync(journalPath)) {
      try {
        fs.unlinkSync(journalPath);
      } catch {
        // Best-effort cleanup only. A locked journal file should not block startup.
      }
    }

    if (fs.existsSync(databasePath) && fs.statSync(databasePath).size === 0) {
      try {
        fs.unlinkSync(databasePath);
      } catch {
        // Best-effort cleanup only. If the file is locked, SQLite open will decide next steps.
      }
    }
  }

  private async migrateMenuItemsImageToNullable(): Promise<void> {
    const columns = await this.all<{ name: string; notnull: number }>(
      'PRAGMA table_info(menu_items);',
    );

    const imageColumn = columns.find((column) => column.name === 'image');
    if (!imageColumn || imageColumn.notnull === 0) {
      return;
    }

    await this.run('PRAGMA foreign_keys = OFF;');

    try {
      await this.run('BEGIN IMMEDIATE TRANSACTION;');
      await this.run('ALTER TABLE menu_items RENAME TO menu_items_old;');
      await this.run(
        `CREATE TABLE menu_items (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL UNIQUE,
            short_description TEXT NOT NULL,
            image TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );`,
      );
      await this.run(
        `INSERT INTO menu_items (id, name, short_description, image, created_at, updated_at)
         SELECT id, name, short_description, image, created_at, updated_at
         FROM menu_items_old;`,
      );
      await this.run('DROP TABLE menu_items_old;');
      await this.run('COMMIT;');
    } catch (error) {
      await this.run('ROLLBACK;');
      throw error;
    } finally {
      await this.run('PRAGMA foreign_keys = ON;');
    }
  }
}
