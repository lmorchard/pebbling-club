import { IKnexConnectionOptions, IKnexRepository } from "../../knex";
import {
  Feed,
  FeedDiscovered,
  FeedExisting,
  FeedItem,
  IFeedsRepository,
} from "../../../services/feeds";
import BaseSqliteKnexRepository from "../base";
import path from "path";
import Knex from "knex";

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
        const result = await trx("FeedDiscoveries")
          .insert(toUpsert)
          .onConflict(["url", "feedUrl"])
          .merge()
          .returning("id");
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
    const { title, url, metadata } = feed;
    const toUpsert = {
      title,
      url,
      metadata: this._serializeMetadataColumn(metadata),
    };
    const result = await this.connection("Feeds")
      .insert(toUpsert)
      .onConflict("url")
      .merge(toUpsert)
      .returning("id");
    return result[0].id;
  }

  async fetchFeed(feedId: string): Promise<FeedExisting | null> {
    const result = await this.connection("Feeds").where({ id: feedId }).first();
    if (!result) return null;
    return {
      ...result,
      metadata: this._deserializeMetadataColumn(result.metadata),
    };
  }

  async fetchFeedByUrl(url: string): Promise<FeedExisting | null> {
    const result = await this.connection("Feeds").where({ url }).first();
    if (!result) return null;
    return {
      ...result,
      metadata: this._deserializeMetadataColumn(result.metadata),
    };
  }

  async upsertFeedItemBatch(feed: Feed, items: FeedItem[]): Promise<string[]> {
    const now = Date.now();
    const feedId = feed.id;
    const results: string[] = [];
    await this.connection.transaction(async (trx) => {
      for (const item of items) {
        const { guid, link, title, description, summary } = item;
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
          firstSeenAt: now,
        };
        const result = await trx("FeedItems")
          .insert(toInsert)
          .onConflict("guid")
          .merge(toUpdate)
          .returning("id");
        results.push(result[0].id);
      }
    });
    return results;
  }

  async fetchItemsForFeed(
    feedId: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; items: FeedItem[] }> {
    const result = await this.connection("FeedItems")
      .where({ feedId })
      .limit(limit)
      .offset(offset);
    return {
      total: result.length,
      items: result,
    };
  }

  async fetchItemsForFeedUrl(
    url: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; items: FeedItem[] }> {
    const feed = await this.fetchFeedByUrl(url);
    if (!feed) return { total: 0, items: [] };
    return this.fetchItemsForFeed(feed.id, limit, offset);
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
