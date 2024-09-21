import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import { IUnfurlRepository, UnfurlMetadata } from "../../../services/unfurl";
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
  sqliteUnfurlMaxage: {
    doc: "Max age for cached unfurl metadata",
    env: "SQLITE_UNFURL_MAXAGE",
    format: Number,
    default: 1000 * 60 * 60,
  },
} as const;

export default class SqliteUnfurlRepository
  extends BaseSqliteKnexRepository
  implements IUnfurlRepository, IKnexRepository, IKnexConnectionOptions
{
  get migrationsDirectory() {
    return path.resolve(path.join(__dirname, "migrations"));
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
    metadata: UnfurlMetadata
  ): Promise<UnfurlMetadata> {
    const cachedAt = Date.now();
    const toUpsert = {
      url,
      cachedAt,
      metadata: this._serializeMetadataColumn(metadata),
    };
    const result = await this.connection("UnfurlCache")
      .insert(toUpsert)
      .onConflict("url")
      .merge()
      .returning("id");
    return metadata;
  }

  async fetchUnfurlMetadata(url: string): Promise<UnfurlMetadata | null> {
    const result = await this.connection("UnfurlCache").where({ url }).first();
    if (!result) return null;
    // TODO: move this into BaseSqliteKnexRepository for reuse?
    const maxage = this.app.config.get("sqliteUnfurlMaxage");
    const now = Date.now();
    const { metadata, cachedAt } = result;
    const age = now - cachedAt;
    return age > maxage
      ? null
      : {
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
