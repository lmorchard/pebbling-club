import path from "path";
import BetterSqlite3, { Database } from 'better-sqlite3';
import { App } from '../../app';
import { BaseRepository } from "../index";
import { mkdirp } from "mkdirp";

export const configSchema = {
} as const;

export class SqliteRepository extends BaseRepository {
  db?: Database;

  constructor(app: App) {
    super(app);
  }

  async init() {
    const { config, log } = this.app.context;

    const dataPath = config.get("dataPath");
    mkdirp.sync(dataPath);
    
    const databaseName = "data.sqlite"; // TODO: add to config

    const db = new BetterSqlite3(
      path.join(dataPath, databaseName),
      {
        verbose: sql => log.trace({ module: "SqliteRepository", sql }),
      }
    );
    db.pragma('journal_mode = WAL');

    return this;
  }

}
