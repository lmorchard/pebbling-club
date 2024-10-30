import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import { IUnfurlRepository, UnfurlResult } from "../../../services/unfurl";
import BaseSqliteKnexRepository from "../base";
import path from "path";
import Knex from "knex";

export const configSchema = {
  sqliteUnfurlDatabaseName: {
    doc: "Filename for sqlite3 unfurl database",
    env: "SQLITE_UNFURL_FILENAME",
    format: String,
    default: "unfurl.sqlite3",
  },
} as const;

export default class SqliteUnfurlRepository
  extends BaseSqliteKnexRepository
  implements IUnfurlRepository, IKnexRepository, IKnexConnectionOptions
{
  get migrationsDirectory() {
    return this._resolveMigrationsDirectory("unfurl");
  }

  knexConnectionOptions(): Knex.Knex.Config["connection"] {
    const { config } = this.app;

    return {
      filename: path.join(
        config.get("sqliteDatabasePath"),
        config.get("sqliteUnfurlDatabaseName")
      ),
    };
  }

  async upsertUnfurlMetadata(
    url: string,
    metadata: UnfurlResult
  ): Promise<UnfurlResult> {
    const cachedAt = Date.now();
    const toUpsert = {
      url,
      cachedAt,
      metadata: this._serializeMetadataColumn(metadata),
    };
    const result = await this.enqueue(() =>
      this.connection("UnfurlCache")
        .insert(toUpsert)
        .onConflict("url")
        .merge()
        .returning("id")
    );
    return metadata;
  }

  async fetchUnfurlMetadata(url: string): Promise<UnfurlResult | null> {
    const result = await this.connection("UnfurlCache").where({ url }).first();
    if (!result) return null;
    const { metadata, cachedAt } = result;
    return {
      cached: true,
      cachedAt,
      ...this._deserializeMetadataColumn(metadata),
    };
  }

  _serializeMetadataColumn(meta = {}) {
    return JSON.stringify(meta);
  }

  _deserializeMetadataColumn(metaRaw: string = "{}") {
    try {
      return JSON.parse(metaRaw);
    } catch (err) {
      /* no-op */
    }
  }
}
