import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import BaseSqliteKnexRepository from "../base";
import path from "path";
import Knex from "knex";
import { IFetchRepository } from "../../../services/fetch";
import { Response, BodyInit, ResponseInit, HeadersInit } from "node-fetch";

export const configSchema = {
  sqliteFetchDatabaseName: {
    doc: "Filename for sqlite3 fetch database",
    env: "SQLITE_FETCH_FILENAME",
    format: String,
    default: "fetch.sqlite3",
  },
} as const;

export default class SqliteFetchRepository
  extends BaseSqliteKnexRepository
  implements IFetchRepository, IKnexRepository, IKnexConnectionOptions
{
  get migrationsDirectory() {
    return path.resolve(path.join(__dirname, "migrations"));
  }

  knexConnectionOptions(): Knex.Knex.Config["connection"] {
    const { config } = this.app;
    return {
      filename: path.join(
        config.get("sqliteDatabasePath"),
        config.get("sqliteFetchDatabaseName")
      ),
    };
  }

  async upsertResponse(
    url: string | URL,
    response: Response
  ): Promise<Response> {
    const { log } = this;
    const { status, statusText } = response;

    log.trace({ msg: "upsertResponse", url: url.toString() });

    const body = Buffer.from(await response.arrayBuffer());

    const toUpsert = {
      url: url.toString(),
      status,
      statusText,
      headers: JSON.stringify(Array.from(response.headers.entries())),
      body,
      cachedAt: Date.now()
    };
    const result = await this.connection("FetchCache")
      .insert(toUpsert)
      .onConflict("url")
      .merge(toUpsert)
      .returning("id");
    return new Response(toUpsert.body, {
      status,
      statusText,
      headers: response.headers.entries(),
    });
  }

  async fetchResponse(
    url: string | URL
  ): Promise<{ response: Response; cachedAt: number } | undefined> {
    const result = await this.connection("FetchCache")
      .where({ url: url.toString() })
      .first();
    if (!result) return;
    const { status, statusText, headers, cachedAt } = result;
    const response = new Response(result.body, {
      status,
      statusText,
      headers: JSON.parse(headers),
    });
    return { response, cachedAt };
  }

  async clearCachedResponses(): Promise<void> {
    return await this.connection("FetchCache").delete();
  }

}

export interface FetchCacheRecord {
  url: string;
  status: number;
  statusText: string;
  headers: string;
  body: Blob;
}
