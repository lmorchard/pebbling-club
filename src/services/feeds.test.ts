import { rimraf } from "rimraf";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "assert";
import { BaseApp } from "../app";
import { IApp } from "../app/types";
import { FeedsService, IFeedsRepository, Feed, FeedDiscovered } from "./feeds";
import SqliteFeedsRepository from "../repositories/sqlite/feeds";
import { FetchResponse, FetchService, IFetchRepository } from "./fetch";
import { Response } from "node-fetch";
import { buildReadableStreamFromString } from "../utils/test";
import SqliteFetchRepository from "../repositories/sqlite/fetch";

describe("services/feeds", () => {
  let app: TestApp;

  describe("autodetect", () => {
    beforeEach(async () => {
      app = new TestApp("data/test/feeds/autodetect");
      await app.init();
    });

    afterEach(async () => {
      await app.deinit();
    });

    it("should detect a feed directly fetched by Content-Type", async (t) => {
      const { feeds } = app;
      const mockFetch = applyFetchMock(t, app.fetch);
      const url = "https://blog.lmorchard.com/index.rss";
      const resource = TEST_RESOURCES[url];

      const result = await feeds.autodiscover(url);

      assert.equal(mockFetch.mock.callCount(), 1);
      assert.equal(mockFetch.mock.calls[0].arguments[0].url, url);
      assert.deepEqual(result, resource.discoveries!);
    });

    it("should detect a feed linked from an HTML resource", async (t) => {
      const { feeds } = app;
      const mockFetch = applyFetchMock(t, app.fetch);
      const url = "https://blog.lmorchard.com";
      const resource = TEST_RESOURCES[url];

      const result = await feeds.autodiscover(url);

      assert.equal(mockFetch.mock.callCount(), 1);
      assert.equal(mockFetch.mock.calls[0].arguments[0].url, url);
      assert.deepEqual(result, resource.discoveries!);
    });

    it("should store results of previous autodiscovery and not fetch again", async (t) => {
      const { feeds, feedsRepository } = app;

      const mockFetch = applyFetchMock(t, app.fetch);
      const mockUpsertDiscoveries = t.mock.method(
        feedsRepository,
        "upsertFeedDiscoveriesBatch"
      );
      const mockFetchDiscoveries = t.mock.method(
        feedsRepository,
        "fetchFeedDiscoveries"
      );

      const url = "https://blog.lmorchard.com";
      const resource = TEST_RESOURCES[url];

      const result1 = await feeds.autodiscover(url);
      assert.deepEqual(result1, resource.discoveries);
      assert.equal(mockFetchDiscoveries.mock.callCount(), 1);
      assert.equal(mockUpsertDiscoveries.mock.callCount(), 1);

      const result2 = await feeds.autodiscover(url);
      assert.deepEqual(result2, result1);

      assert.equal(mockFetch.mock.callCount(), 1);
      assert.equal(mockFetch.mock.calls[0].arguments[0].url, url);
      assert.equal(mockFetchDiscoveries.mock.callCount(), 2);
      assert.equal(mockUpsertDiscoveries.mock.callCount(), 1);
    });
  });

  describe("poll", () => {
    beforeEach(async () => {
      app = new TestApp("data/test/feeds/poll");
      await app.init();
    });

    afterEach(async () => {
      await app.deinit();
    });

    it("should poll the feed", async (t) => {
      const { feeds } = app;

      const url = "https://blog.lmorchard.com/index.rss";
      const feed = TEST_RESOURCES[url].feed!;

      const mockFetch = applyFetchMock(t, app.fetch);

      const result = await feeds.poll(feed, {
        forceFetch: true,
        timeout: 5000,
        maxage: 1000,
      });

      assert.equal(mockFetch.mock.callCount(), 1);
      assert.equal(mockFetch.mock.calls[0].arguments[0].url, feed.url);
      assert.ok(result);
      assert.equal(result.feed.url, feed.url);
      assert.equal(result.items.length, 5);
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      app = new TestApp("data/test/feeds/update");
      await app.init();
    });

    afterEach(async () => {
      await app.deinit();
    });

    it("should create the feed on initial update", async (t) => {
      const { feeds } = app;

      const mockFetch = applyFetchMock(t, app.fetch);

      const url = "https://blog.lmorchard.com/index.rss";
      const feed = {
        ...TEST_RESOURCES[url].feed!,
        id: undefined,
      };

      const result = await feeds.update(feed);
      assert.equal(mockFetch.mock.callCount(), 1);
      assert.equal(mockFetch.mock.calls[0].arguments[0].url, feed.url);
      assert.ok(result);
      assert.equal(result.itemIds.length, 5);
    });

    it("should update an existing feed on subsequent updates", async (t) => {
      const { feeds } = app;

      const mockFetch = applyFetchMock(t, app.fetch);

      const url = "https://blog.lmorchard.com/index.rss";
      const feed = { ...TEST_RESOURCES[url].feed! };

      const result1 = await feeds.update(feed);

      assert.equal(mockFetch.mock.callCount(), 1);
      assert.equal(mockFetch.mock.calls[0].arguments[0].url, feed.url);
      assert.ok(result1);
      assert.equal(result1.itemIds.length, 5);

      const feedId = result1.feedId;
      const feed2 = { ...feed, id: feedId };

      const result2 = await feeds.update(feed2, { forceFetch: true });

      assert.equal(mockFetch.mock.callCount(), 2);
      assert.equal(mockFetch.mock.calls[1].arguments[0].url, feed.url);
      assert.ok(result2);
      assert.equal(result2.itemIds.length, 5);

      assert.deepEqual(result1.feedId, result2.feedId);
      assert.deepEqual(result1.itemIds, result2.itemIds);
    });
  });
});

const applyFetchMock = (
  t: any,
  fetch: FetchService,
  resources = TEST_RESOURCES
) => {
  return t.mock.method(
    fetch,
    "fetchResource",
    async ({ url }: { url: string | URL }): Promise<FetchResponse> => {
      const urlStr = url.toString();
      if (!(urlStr in resources)) {
        return {
          response: new Response(null, { status: 404 }),
          meta: { cached: false },
        };
      }

      const resource = resources[urlStr];
      const resourceStream = buildReadableStreamFromString(resource.body);

      return {
        response: new Response(resourceStream, {
          status: 200,
          headers: resource.headers,
        }),
        meta: { cached: false },
      };
    }
  );
};

export class TestApp extends BaseApp implements IApp {
  feedsRepository: IFeedsRepository;
  fetchRepository: IFetchRepository;
  fetch: FetchService;
  feeds: FeedsService;

  constructor(testDatabasePath = "data/test/feeds") {
    super();

    this.modules.push(
      (this.feedsRepository = new SqliteFeedsRepository(this)),
      (this.fetchRepository = new SqliteFetchRepository(this)),
      (this.fetch = new FetchService(this, this.fetchRepository)),
      (this.feeds = new FeedsService(this, this.feedsRepository, this.fetch))
    );

    this.config.set("sqliteDatabasePath", testDatabasePath);
  }

  async init() {
    await rimraf(this.config.get("sqliteDatabasePath"));
    return super.init();
  }

  async deinit() {
    await super.deinit();
    //await rimraf(this.config.get("sqliteDatabasePath"));
  }
}

type TestResources = {
  headers: Record<string, string>;
  body: string;
  feed?: Feed;
  discoveries?: FeedDiscovered[];
};

const TEST_RESOURCES: Record<string, TestResources> = {
  "https://blog.lmorchard.com": {
    discoveries: [
      {
        title: "blog.lmorchard.com",
        type: "application/rss+xml",
        rel: "link",
        href: "https://blog.lmorchard.com/index.rss",
      },
      {
        title: "blog.lmorchard.com comments",
        type: "application/rss+xml",
        rel: "link",
        href: "https://blog.lmorchard.com/comments.rss",
      },
      {
        title: "blog.lmorchard.com linkblog",
        type: "application/atom+xml",
        rel: "link",
        href: "https://blog.lmorchard.com/linkblog.atom",
      },
    ],
    headers: {
      "content-type": "text/html",
    },
    body: `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Home - blog.lmorchard.com</title>
          <meta property="og:type" content="article" />
          <meta property="og:site_name" content="blog.lmorchard.com" />
          <meta http-equiv="content-type" content="text/html; charset=utf-8" />
          <meta name="author" content="Les Orchard" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
          />
          <link
            rel="shortcut icon"
            href="https://www.gravatar.com/avatar/b45c48fc9e05922e2f368a9d7d7d8de1?s=16"
          />

          <script
            defer
            data-domain="blog.lmorchard.com"
            src="https://analytics.lmorchard.com/js/plausible.js"
          ></script>

          <link rel="stylesheet" type="text/css" href="/index.css" />
          <script type="module" src="/index.js"></script>

          <link
                  href="/index.rss"
                  rel="alternate"
                  title="blog.lmorchard.com"
                  type="application/rss+xml"
                />

          <link
                href="/comments.rss"
                rel="alternate"
                title="blog.lmorchard.com comments"
                type="application/rss+xml"
              />
        
          <link
                href="/linkblog.atom"
                rel="alternate"
                title="blog.lmorchard.com linkblog"
                type="application/atom+xml"
              />
        
        </head>
        <body>
          <p>...</p>
        </body>
      </html>
    `,
  },
  "https://blog.lmorchard.com/index.rss": {
    headers: {
      "content-type": "application/rss+xml",
    },
    feed: {
      title: "blog.lmorchard.com",
      url: "https://blog.lmorchard.com/index.rss",
    },
    discoveries: [
      {
        type: "application/rss+xml",
        rel: "self",
        href: "https://blog.lmorchard.com/index.rss",
      },
    ],
    body: `
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
        <channel>
          <title>blog.lmorchard.com</title>
          <description>It&#39;s all spinning wheels &amp; self-doubt until the first pot of coffee.</description>
          <link>https://blog.lmorchard.com</link>
          <atom:link href="https://blog.lmorchard.com/index.rss" rel="self" type="application/rss+xml" />
          <item>
              <title>You Wake Up</title>
              <description>TL;DR: A creative writing exercise inspired by getting up too many times last night.</description>

              <pubDate>Thu, 12 Sep 2024 12:00:00 GMT</pubDate>
              <link>https://blog.lmorchard.com/2024/09/12/you-wake-up/</link>
              <guid isPermaLink="true">https://blog.lmorchard.com/2024/09/12/you-wake-up/</guid>
            </item><item>
              <title>I like automations for inclusive development</title>
              <description>TL;DR: I like deploying robots to include more of the team in our core development loop</description>

              <pubDate>Wed, 13 Mar 2024 12:00:00 GMT</pubDate>
              <link>https://blog.lmorchard.com/2024/03/13/github-actions-for-didthis/</link>
              <guid isPermaLink="true">https://blog.lmorchard.com/2024/03/13/github-actions-for-didthis/</guid>
            </item><item>
              <title>Dance like the bots aren&#39;t watching?</title>
              <description>TL;DR: Why bother sharing anything on the open web if it&#39;s just going to be fodder for extractive, non-reciprocal bots?</description>

              <pubDate>Mon, 11 Mar 2024 12:00:00 GMT</pubDate>
              <link>https://blog.lmorchard.com/2024/03/11/dance-for-the-bots/</link>
              <guid isPermaLink="true">https://blog.lmorchard.com/2024/03/11/dance-for-the-bots/</guid>
            </item><item>
              <title>Using SQLite as a document database for Mastodon exports</title>
              <description>TL;DR: SQLite has JSON functions, generated columns, and full-text search - which all seems like a perfect mix for ingesting exports from Mastodon for search!</description>

              <pubDate>Fri, 12 May 2023 12:00:00 GMT</pubDate>
              <link>https://blog.lmorchard.com/2023/05/12/toots-in-sqlite/</link>
              <guid isPermaLink="true">https://blog.lmorchard.com/2023/05/12/toots-in-sqlite/</guid>
            </item><item>
              <title>Begging for Treats</title>
              <description>TL;DR: Ever wonder what would happen if a Kardashev Type II civilization found us cute?</description>

              <pubDate>Mon, 16 Jan 2023 12:00:00 GMT</pubDate>
              <link>https://blog.lmorchard.com/2023/01/16/begging-for-treats/</link>
              <guid isPermaLink="true">https://blog.lmorchard.com/2023/01/16/begging-for-treats/</guid>
            </item>
        </channel>
      </rss>
    `,
  },
} as const;
