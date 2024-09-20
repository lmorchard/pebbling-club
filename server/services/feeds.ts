import crypto from "crypto";
import iconv from "iconv-lite";
import { Response } from "node-fetch";
import FeedParser, { Meta, Item } from "feedparser";
import { WritableStream as HTMLWritableStream } from "htmlparser2/lib/WritableStream";
import { IApp } from "../app/types";
import { FetchService } from "./fetch";
import { AppModule } from "../app/modules";

export const configSchema = {
  feedPollMaxAge: {
    doc: "Default max age to consider a fetched feed fresh",
    format: Number,
    default: 1000 * 60 * 15,
  },
  feedPollMaxItems: {
    doc: "Maximum number of items to accept per feed poll",
    format: Number,
    default: 50,
  },
  feedPollTimeout: {
    doc: "Timeout in milliseconds for fetching a feed",
    format: Number,
    default: 20000,
  },
};

export type FeedPollOptions = {
  forceFetch?: boolean;
  timeout?: number;
  maxage?: number;
};

export type IAppRequirements = {
  feedsRepository: IFeedsRepository;
  fetch: FetchService;
};

export class FeedsService extends AppModule<IAppRequirements> {
  async get(
    urlIn: string,
    options: FeedPollOptions & {
      autodiscover?: boolean;
      update?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const {
      autodiscover = true,
      update = true,
      limit = 50,
      offset = 0,
      ...fetchOptions
    } = options;

    let url = urlIn;

    if (autodiscover) {
      const discovery = await this.autodiscover(url);
      if (discovery.length) {
        url = discovery[0].href;
      }
    }

    if (update) {
      const updateResult = await this.update({ url }, fetchOptions);
      if (updateResult) {
        const { feed, items } = updateResult;
        return {
          feed,
          items: {
            total: items.length,
            items,
          },
        };
      }
    }

    const feed = await this.app.feedsRepository.fetchFeedByUrl(url);
    if (!feed) return null;

    const items = await this.app.feedsRepository.fetchItemsForFeed(
      feed?.id,
      limit,
      offset
    );

    return { feed, items };
  }

  async autodiscover(url: string, options: { forceFetch?: boolean } = {}) {
    const { log, app } = this;
    const { fetch, feedsRepository: repository } = app;

    log.trace({ msg: "autodiscover", url });

    const discovered: FeedDiscovered[] = [];

    if (!options.forceFetch) {
      const storedResults = await repository.fetchFeedDiscoveries(url);
      if (storedResults.length) {
        log.trace({ msg: "using stored autodiscovery results" });
        return storedResults;
      }
    }

    const controller = new AbortController();
    const { response } = await fetch.fetchResource({ url, controller });
    if (!response || response.status !== 200) {
      throw new FeedAutodiscoverError(
        "failed to fetch resource",
        undefined,
        response?.status
      );
    }

    const contentTypeHeader = response.headers.get("content-type");
    if (contentTypeHeader) {
      const parts = contentTypeHeader.split(";");
      if (parts.length) {
        const contentType = parts[0];
        if (FEED_TYPES.includes(contentType as FeedType)) {
          discovered.push({
            type: contentType as FeedType,
            rel: "self",
            href: url,
          });
        }
      }
    }

    // The resource itself isn't a feed, so let's dig through the body as HTML
    if (!discovered.length) {
      const bodyStream = response.body;
      if (!bodyStream) throw Error(`failed to get body stream`);

      await new Promise<void>((resolve, reject) => {
        let inHead = false;

        const openHeadHandler = (
          name: string,
          attribs: Record<string, string>
        ) => {
          if (name === "head") {
            inHead = true;
          } else if (inHead) {
            if (
              name === "link" &&
              attribs &&
              attribs.rel &&
              attribs.rel === "alternate"
            ) {
              const { rel, href, type } = attribs;
              if (FEED_TYPES.includes(type as FeedType)) {
                discovered.push({
                  type: type as FeedType,
                  rel: "link",
                  href: new URL(href, url).toString(),
                  title: attribs.title,
                });
              }
            }
          }
        };

        const closeHeadHandler = (name: string) => {
          if (name === "head") {
            inHead = false;
            // TOOD: does this actually abort the stream?
            //controller.abort();
            //parser.end();
          }
        };

        const parser = new HTMLWritableStream({
          onopentag: openHeadHandler,
          onclosetag: closeHeadHandler,
          onend: () => resolve(),
          onerror: (error) => reject(error),
        });

        bodyStream.pipe(parser);
      });
    }

    log.debug({ msg: "Autodiscovered feed URLs", url, discovered });
    await repository.upsertFeedDiscoveriesBatch(url, discovered);
    return discovered;
  }

  // TODO: implement new / seen / defunct item GUID tracking for purge logic
  // TODO: implement newest item date tracking for feed update for sorting logic
  // TODO: add a p-queue to limit concurrent feed polls
  // TODO: use last headers from previous fetch (if not already)
  async update(feedIn: Feed, options: FeedPollOptions = {}) {
    const {
      log,
      app: { config, feedsRepository: repository },
    } = this;

    log.trace({ msg: "updateFeed", feed: feedIn, options });

    const { forceFetch = false, maxage = config.get("feedPollMaxAge") } =
      options;

    let feed: Feed | FeedExisting | null = !!feedIn.id
      ? await repository.fetchFeed(feedIn.id)
      : await repository.fetchFeedByUrl(feedIn.url);
    if (!feed) {
      feed = { ...feedIn };
      log.trace({ msg: "fetching new feed", feed });
    } else {
      log.trace({ msg: "fetched feed for update", feed });
    }

    if (!forceFetch && feed.metadata?.lastFetched) {
      const age = Date.now() - feed.metadata.lastFetched;
      log.trace({ msg: "checking feed freshness", age, maxage });
      if (age < maxage) {
        log.debug({
          msg: "feed still fresh, skipping update",
          url: feed.url,
          age,
          maxage,
        });
        return;
      }
    }

    const result = await this.poll(feed, options);
    if (!result) return;

    const { feed: feedUpdates, items } = result;
    const feedId = await this.app.feedsRepository.upsertFeed(feedUpdates);
    const itemIds = await this.app.feedsRepository.upsertFeedItemBatch(
      {
        id: feedId,
        ...feedUpdates,
      },
      items
    );
    return { feed: feedUpdates, items, feedId, itemIds };
  }

  // TODO: add a p-queue to limit concurrent feed polls
  async poll(feed: Feed, options: FeedPollOptions = {}) {
    const {
      log,
      app: { config, fetch },
    } = this;
    const {
      forceFetch = false,
      timeout = config.get("feedPollTimeout"),
      maxage = config.get("feedPollMaxAge"),
    } = options;

    const { id: feedId, disabled = false, title, url, metadata = {} } = feed;
    const { lastFetched = 0, lastHeaders = {} } = metadata;
    const timeStart = Date.now();
    const logCommon = { feedId, title, url };

    const feedUpdates: Feed = {
      ...feed,
      metadata: {
        ...feed.metadata,
      },
    };
    const itemsToUpsert = [];

    try {
      log.debug({ msg: "Feed poll start", ...logCommon });

      if (disabled) {
        log.info({ msg: "Feed poll skipped", ...logCommon, disabled });
        return;
      }

      const age = timeStart - lastFetched;
      if (!forceFetch && lastFetched !== 0 && age < maxage) {
        log.info({
          msg: "Feed poll skipped",
          ...logCommon,
          age,
          maxage,
        });
        return;
      }

      const { response } = await fetch.fetchResource({
        url,
        lastHeaders,
        timeout,
        forceFetch,
      });
      if (!response) {
        throw new FeedPollError("no response", null, feedUpdates, []);
      }

      Object.assign(feedUpdates.metadata!, {
        lastFetched: Date.now(),
        lastStatus: response.status,
        lastStatusText: response.statusText,
        lastHeaders: response.headers.raw(),
      });

      log.debug({
        msg: "Fetched feed",
        status: response.status,
        statusText: response.statusText,
        ...logCommon,
      });

      if (response.status !== 200) {
        // This is most likely where we hit 304 Not Modified, so skip parsing.
        log.debug({ msg: "Feed parse skipped", ...logCommon });
      } else {
        let { stream, charset } = normalizeFeedCharset(response, feed);
        const { meta, items } = await parseFeedStream(stream, url);

        for (let rawItem of items.slice(0, config.get("feedPollMaxItems"))) {
          const { link, title, description, summary } = rawItem;
          const item: FeedItem = {
            link,
            title,
            summary,
            description: description || summary,
            date: itemDate(rawItem),
            guid: itemGuid(rawItem),
            metadata: {
              itemMeta: rawItem,
            },
          };
          itemsToUpsert.push(item);
        }

        Object.assign(feedUpdates, {
          title: meta.title,
          link: meta.link,
        });

        Object.assign(feedUpdates.metadata!, {
          charset,
          feedMeta: meta,
          lastParsed: Date.now(),
          parseDuration: Date.now() - timeStart,
        });

        log.debug({
          msg: "Feed parse complete",
          ...logCommon,
          itemCount: items.length,
        });
      }
    } catch (err) {
      Object.assign(feedUpdates.metadata!, {
        lastFetched: timeStart,
        lastError: err,
        duration: Date.now() - timeStart,
      });

      if (err instanceof Error) {
        if ("type" in err && err.type === "AbortError") {
          throw new FeedPollError("timed out", err, feedUpdates, itemsToUpsert);
        }
        throw new FeedPollError(err.message, err, feedUpdates, itemsToUpsert);
      }
      throw new FeedPollError(
        "unexpected error",
        err,
        feedUpdates,
        itemsToUpsert
      );
    }

    return {
      feed: feedUpdates,
      items: itemsToUpsert,
    };
  }
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
  items: FeedItem[];

  constructor(
    message: string,
    originalError: any,
    feed: Feed,
    items: FeedItem[]
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

const FEED_TYPES = [
  "text/xml",
  "application/rss+xml",
  "application/atom+xml",
  "application/rdf+xml",
] as const;

type FeedType = (typeof FEED_TYPES)[number];

export type FeedDiscovered = {
  type: FeedType;
  rel: "self" | "link";
  href: string;
  title?: string;
};

// Relevant date for an item has a bit of variance, so let's
// work with some fallbacks. Also, treat future dates as *now*,
// since I've seen a few feeds behave badly that way.
const itemDate = ({ date, pubdate }: FeedParser.Item) => {
  const now = new Date();
  const candidate = new Date(date || pubdate || now);
  return candidate < now ? candidate : now;
};

// Some items don't have a guid, so let's use a hash of the
// title & link as a rough fallback
const itemGuid = ({ guid, title = "", link = "" }: FeedParser.Item) =>
  guid || crypto.createHash("md5").update(title).update(link).digest("hex");

const parseFeedStream = (stream: NodeJS.ReadableStream, url: string) =>
  new Promise<{
    meta: Meta;
    items: Item[];
  }>((resolve, reject) => {
    let meta: FeedParser.Meta;
    const items: FeedParser.Item[] = [];

    const parser = new FeedParser({
      addmeta: false,
      feedurl: url,
    });

    parser.on("readable", function (this: FeedParser) {
      meta = this.meta as FeedParser.Meta;
      let item;
      while ((item = this.read())) {
        items.push(item);
      }
    });
    parser.on("error", reject);
    parser.on("end", () => resolve({ meta, items }));

    stream.pipe(parser);
  });

function normalizeFeedCharset(response: Response, feed: Feed) {
  const charset = detectCharsetFromFeed(response, feed);
  let stream = response.body;
  if (!stream) {
    throw new Error("Response body missing");
  }
  if (charset !== "utf-8") {
    stream = stream
      .pipe(iconv.decodeStream(charset))
      .pipe(iconv.encodeStream("utf-8"));
  }
  return { stream, charset };
}

function detectCharsetFromFeed(response: Response, feed: Feed) {
  const contentType = response.headers.get("content-type");
  const contentTypeParams = getContentTypeParams(contentType || "");
  let charset: string | undefined = contentTypeParams.charset;

  if (!charset && feed.metadata?.charset) {
    // Try to guess a charset from previous parsing
    // Maybe we need to do a speculative parsing instead to
    // get XML encoding from doctype?
    let prevCharset: string | undefined = feed.metadata?.charset;
    if (!prevCharset) {
      prevCharset = feed.metadata?.feedMeta?.["#xml"].encoding;
    }
    charset = prevCharset;
  }

  return charset || "utf-8";
}

function getContentTypeParams(str: string) {
  return str
    .split(";")
    .reduce(function (params: Record<string, string>, param: string) {
      var parts = param.split("=").map(function (part) {
        return part.trim();
      });
      if (parts.length === 2) {
        params[parts[0]] = parts[1];
      }
      return params;
    }, {});
}

export interface IFeedsRepository {
  upsertFeedDiscoveriesBatch(
    url: string,
    discoveries: FeedDiscovered[]
  ): Promise<string[]>;
  fetchFeedDiscoveries(url: string): Promise<FeedDiscovered[]>;
  upsertFeed(feed: Feed): Promise<string>;
  upsertFeedItemBatch(feed: Feed, items: FeedItem[]): Promise<string[]>;
  fetchFeed(feedId: string): Promise<FeedExisting | null>;
  fetchFeedByUrl(url: string): Promise<FeedExisting | null>;
  fetchItemsForFeed(
    feedId: string,
    limit: number,
    offset: number
  ): Promise<{
    total: number;
    items: FeedItem[];
  }>;
  fetchItemsForFeedUrl(
    url: string,
    limit: number,
    offset: number
  ): Promise<{ total: number; items: FeedItem[] }>;
}

export type Feed = {
  id?: string;
  url: string;
  disabled?: boolean;
  title?: string;
  link?: string;
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
  metadata?: {
    itemMeta?: FeedParser.Item;
  };
};

export type FeedItemExisting = FeedItem & {
  id: string;
};
