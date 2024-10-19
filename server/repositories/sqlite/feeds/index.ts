import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import {
  Feed,
  FeedDiscovered,
  FeedExisting,
  FeedItem,
  IFeedsRepository,
  FeedItemListOptions,
} from "../../../services/feeds";
import BaseSqliteKnexRepository from "../base";
import path from "path";
import Knex from "knex";
import { Transform } from "stream";

export const configSchema = {
  sqliteFeedsDatabaseName: {
    doc: "Filename for sqlite3 feeds database",
    env: "SQLITE_FEEDS_FILENAME",
    format: String,
    default: "feeds.sqlite3",
  },
} as const;

export default class SqliteFeedsRepository
  extends BaseSqliteKnexRepository
  implements IFeedsRepository, IKnexRepository, IKnexConnectionOptions
{
  get migrationsDirectory() {
    return path.resolve(path.join(__dirname, "migrations"));
  }

  knexConnectionOptions(): Knex.Knex.Config["connection"] {
    const { config } = this.app;

    return {
      filename: path.join(
        config.get("sqliteDatabasePath"),
        config.get("sqliteFeedsDatabaseName")
      ),
    };
  }

  async upsertFeedDiscoveriesBatch(
    url: string,
    discoveries: FeedDiscovered[]
  ): Promise<string[]> {
    const results: string[] = [];
    await this.connection.transaction(async (trx) => {
      for (let idx = 0; idx < discoveries.length; idx++) {
        const { href: feedUrl, type, rel, title } = discoveries[idx];
        const toUpsert = { url, feedUrl, type, rel, title, priority: idx };
        const result = await this.enqueue(() =>
          trx("FeedDiscoveries")
            .insert(toUpsert)
            .onConflict(["url", "feedUrl"])
            .merge()
            .returning("id")
        );
        results.push(result[0].id);
      }
    });
    return results;
  }

  async fetchFeedDiscoveries(url: string): Promise<FeedDiscovered[]> {
    // TODO: filter out results past a configured maxage?
    const results = await this.connection("FeedDiscoveries")
      .where({ url })
      .orderBy("priority");
    return results.map(({ url, feedUrl, type, rel, title }) => ({
      href: feedUrl,
      type,
      rel,
      title,
    }));
  }

  async upsertFeed(feed: Feed): Promise<string> {
    const { title, url, newestItemDate, metadata } = feed;
    const toUpsert = {
      title,
      url,
      newestItemDate: newestItemDate && newestItemDate.toISOString(),
      metadata: this._serializeMetadataColumn(metadata),
    };
    const result = await this.enqueue(() =>
      this.connection("Feeds")
        .insert(toUpsert)
        .onConflict("url")
        .merge(toUpsert)
        .returning("id")
    );
    return result[0].id;
  }

  fetchAllFeeds(): NodeJS.ReadableStream {
    const self = this;
    const feedStream = new Transform({
      objectMode: true,
      transform(row, encoding, callback) {
        this.push(self._rowToFeed(row));
        callback();
      },
    });
    this.connection("Feeds").pipe(feedStream);
    return feedStream;
  }

  async fetchFeed(feedId: string): Promise<FeedExisting | null> {
    const result = await this.connection("Feeds").where({ id: feedId }).first();
    if (!result) return null;
    return this._rowToFeed(result);
  }

  async fetchFeedByUrl(url: string): Promise<FeedExisting | null> {
    const result = await this.connection("Feeds").where({ url }).first();
    if (!result) return null;
    return this._rowToFeed(result);
  }

  _rowToFeed(row: any) {
    return {
      ...row,
      newestItemDate: row.newestItemDate && new Date(row.newestItemDate),
      metadata: this._deserializeMetadataColumn(row.metadata),
    };
  }

  async upsertFeedItemBatch(
    feed: Feed,
    items: Partial<FeedItem>[]
  ): Promise<string[]> {
    const now = Date.now();
    const feedId = feed.id;
    const results: string[] = [];
    await this.enqueue(() =>
      this.connection.transaction(async (trx) => {
        for (const item of items) {
          const { guid, link, title, description, summary, date } = item;
          const toUpdate = {
            link,
            title,
            description,
            summary,
            lastSeenAt: now,
          };
          const toInsert = {
            ...toUpdate,
            feedId,
            guid,
            date: date?.toISOString(),
            firstSeenAt: now,
          };
          const result = await trx("FeedItems")
            .insert(toInsert)
            .onConflict("guid")
            .merge(toUpdate)
            .returning("id");
          results.push(result[0].id);
        }
      })
    );
    return results;
  }

  async updateFeedNewestItemDate(feedId: string): Promise<void> {
    await this.connection.raw(
      `--sql
        update Feeds set newestItemDate=(
          select date
          from FeedItems
          where feedId=?
          order by date
          desc limit 1
        ) where id=?
      `,
      [feedId, feedId]
    );
  }

  async fetchItemsForFeed(
    feedId: string,
    options: FeedItemListOptions
  ): Promise<{ total: number; items: FeedItem[] }> {
    const { limit, offset, order = "date", since } = options;
    const query = this.connection("FeedItems")
      .where({ feedId })
      .orderBy("date", "desc")
      .limit(limit)
      .offset(offset);
    if (since) {
      query.where("date", ">", since.toISOString());
    }
    const result = await query;
    return {
      total: result.length,
      items: this._rowsToFeedItems(result),
    };
  }

  async fetchItemsForFeedUrl(
    url: string,
    options: FeedItemListOptions
  ): Promise<{ total: number; items: FeedItem[] }> {
    const feed = await this.fetchFeedByUrl(url);
    if (!feed) return { total: 0, items: [] };
    return this.fetchItemsForFeed(feed.id, options);
  }

  _rowsToFeedItems(rows: any[]) {
    return rows.map((row) => ({
      ...row,
      date: row.date ? new Date(row.date) : null,
    }));
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
