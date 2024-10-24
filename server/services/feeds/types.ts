import FeedParser from "feedparser";

export interface IFeedsRepository {
  upsertFeedDiscoveriesBatch(
    url: string,
    discoveries: FeedDiscovered[]
  ): Promise<string[]>;
  fetchFeedDiscoveries(url: string): Promise<FeedDiscovered[]>;
  upsertFeed(feed: Feed): Promise<string>;
  upsertFeedItemBatch(
    feed: Feed,
    items: Partial<FeedItem>[]
  ): Promise<string[]>;
  updateFeedNewestItemDate(feedId: string): Promise<void>;
  fetchAllFeeds(): NodeJS.ReadableStream;
  fetchFeed(feedId: string): Promise<FeedExisting | null>;
  fetchFeedByUrl(url: string): Promise<FeedExisting | null>;
  fetchItemsForFeed(
    feedId: string,
    options: FeedItemListOptions
  ): Promise<{
    total: number;
    items: FeedItem[];
  }>;
  fetchItemsForFeedUrl(
    url: string,
    options: FeedItemListOptions
  ): Promise<{ total: number; items: FeedItem[] }>;
}

export interface FeedItemListOptions {
  limit: number;
  offset: number;
  order?: string;
  since?: Date;
}

export class FeedServiceError extends Error {
  originalError: any;

  constructor(message: string, originalError: any) {
    super(message);
    this.originalError = originalError;
  }
}

export class FeedPollError extends FeedServiceError {
  feed: Feed;
  items: Partial<FeedItem>[];

  constructor(
    message: string,
    originalError: any,
    feed: Feed,
    items: Partial<FeedItem>[]
  ) {
    super(message, originalError);
    this.feed = feed;
    this.items = items;
  }
}

export class FeedAutodiscoverError extends FeedServiceError {
  status?: number;

  constructor(message: string, originalError: any, status?: number) {
    super(message, originalError);
    this.status = status;
  }
}

export const FEED_TYPES = [
  "text/xml",
  "application/rss+xml",
  "application/atom+xml",
  "application/rdf+xml",
] as const;

export type FeedType = (typeof FEED_TYPES)[number];

export type FeedDiscovered = {
  type: FeedType;
  rel: "self" | "link";
  href: string;
  title?: string;
};

export type Feed = {
  id?: string;
  url: string;
  disabled?: boolean;
  title?: string;
  link?: string;
  newestItemDate?: Date;
  metadata?: {
    lastFetched?: number;
    lastParsed?: number;
    lastStatus?: number;
    lastStatusText?: string;
    lastHeaders?: Record<string, string>;
    lastError?: any;
    parseDuration?: number;
    charset?: string;
    feedMeta?: FeedParser.Meta & { "#xml": { encoding: string } };
  };
};

export type FeedExisting = Feed & {
  id: string;
};

export type FeedItem = {
  guid: string;
  link?: string;
  title?: string;
  description?: string;
  summary?: string;
  date: Date | null;
  firstSeenAt?: Date | null;
  lastSeenAt?: Date | null;
  metadata?: {
    itemMeta?: FeedParser.Item;
  };
};

export type FeedItemExisting = FeedItem & {
  id: string;
};
