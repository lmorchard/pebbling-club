import { FeedsService } from "./index";
import { Feed, FeedItem, FeedPollError } from "./types";
import {
  normalizeFeedCharset,
  parseFeedStream,
  itemGuid,
  itemDate,
} from "./utils";

export type FeedPollOptions = {
  forceFetch?: boolean;
  timeout?: number;
  maxage?: number;
};

export async function poll(
  this: FeedsService,
  feed: Feed,
  options: FeedPollOptions = {}
) {
  const { app } = this;
  const { config, fetch } = app;
  const { forceFetch = false, timeout = config.get("feedPollTimeout") } =
    options;

  const timeStart = Date.now();

  const { id: feedId, title, url, metadata = {} } = feed;
  const log = this.log.child({ feedId, title, url });

  const { lastHeaders = {} } = metadata;

  const feedUpdates: Feed = {
    ...feed,
    metadata: {
      ...feed.metadata,
    },
  };

  const itemsToUpsert: Partial<FeedItem>[] = [];

  try {
    log.debug({ msg: "Feed poll start" });

    const response = await fetch.fetchResource({
      url,
      accept: "application/rss+xml, text/rss+xml, text/xml",
      lastHeaders: forceFetch ? {} : lastHeaders,
      timeout,
      forceFetch,
      enableCache: forceFetch,
    });
    if (!response) {
      throw new FeedPollError("no response", null, feedUpdates, []);
    }

    Object.assign(feedUpdates.metadata!, {
      lastFetched: Date.now(),
      lastStatus: response.status,
      lastHeaders: response.headers,
    });

    log.debug({
      msg: "Fetched feed",
      status: response.status,
    });

    if (response.status !== 200) {
      // This is most likely where we hit 304 Not Modified, so skip parsing.
      log.debug({ msg: "Feed parse skipped" });
    } else {
      let { stream, charset } = normalizeFeedCharset(response, feed);
      const { meta, items } = await parseFeedStream(stream, url);

      for (let rawItem of items.slice(0, config.get("feedPollMaxItems"))) {
        const { link, title, description, summary } = rawItem;
        const guid = itemGuid(rawItem);
        const date = itemDate(rawItem);

        const toUpsert = {
          guid,
          date,
          link,
          title,
          summary,
          description: description || summary,
          metadata: {
            itemMeta: rawItem,
          },
        };

        itemsToUpsert.push(toUpsert);
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
