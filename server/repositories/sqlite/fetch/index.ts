import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import BaseSqliteKnexRepository from "../base";
import path from "path";
import Knex from "knex";
import {
  IFetchRepository,
  FetchResponse,
  FetchResponseFromCache,
} from "../../../services/fetch";
import BodyReadable from "undici/types/readable";
// @ts-ignore
import { Readable as BodyReadableImpl } from "undici/lib/api/readable";

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
    response: FetchResponse
  ): Promise<FetchResponse> {
    const { log } = this;
    log.trace({ msg: "upsertResponse", url: url.toString() });

    const { status, headers, body } = response;
    if (!body) throw new Error("no body in response");

    const bodyData = await body.arrayBuffer();

    const toUpsert = {
      url: url.toString(),
      status,
      headers: JSON.stringify(headers),
      body: Buffer.from(bodyData),
      cachedAt: Date.now(),
    };

    await this.connection("FetchCache")
      .insert(toUpsert)
      .onConflict("url")
      .merge(toUpsert)
      .returning("id");

    return {
      status,
      headers,
      body: this._bodyReadableFromBuffer(toUpsert.body),
    };
  }

  async fetchResponse(
    url: string | URL
  ): Promise<FetchResponseFromCache | undefined> {
    const result = await this.connection("FetchCache")
      .where({ url: url.toString() })
      .first();
    if (!result) return;

    const { status, headers, cachedAt } = result;

    return {
      status,
      headers: JSON.parse(headers),
      body: this._bodyReadableFromBuffer(result.body),
      cachedAt,
      cached: true,
    };
  }

  _bodyReadableFromBuffer(data: Buffer) {
    const body = new BodyReadableImpl({
      // TODO: supply content-type and content-length here? 
    }) as BodyReadable;
    body.push(data);
    body.push(null);
    return body;
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
