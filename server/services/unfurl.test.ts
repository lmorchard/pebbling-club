import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "assert";
import { rimraf } from "rimraf";
import { UnfurlService, UnfurlMetadata } from "./unfurl";
import { BaseApp } from "../app";
import { IApp } from "../app/types";
import SqliteFetchRepository from "../repositories/sqlite/fetch";
import { FetchService } from "./fetch";
import SqliteUnfurlRepository from "../repositories/sqlite/unfurl";
import { applyFetchMock } from "../utils/test";
import { BookmarksService } from "./bookmarks";
import { SqliteRepository } from "../repositories/sqlite/main";

describe("services/unfurl", () => {
  describe("fetchMetadata", () => {
    let app: TestApp;

    beforeEach(async () => {
      app = new TestApp("data/test/unfurl/fetchMetadata");
      await app.init();
    });

    afterEach(async () => {
      await app.deinit();
    });

    it("should fetch metadata for URLs", async (t) => {
      const { unfurl } = app;
      const mockFetch = applyFetchMock(t, app.fetch, TEST_RESOURCES);

      const urls = [
        "https://blog.lmorchard.com/2024/09/12/you-wake-up/",
        // TODO: get more test cases
      ];

      for (const url of urls) {
        try {
          mockFetch.mock.resetCalls();

          const metadata = await unfurl.fetchMetadata(url);

          assert.equal(mockFetch.mock.callCount(), 1);
          assert.equal(mockFetch.mock.calls[0].arguments[0].url, url);

          const expectedMetadata = TEST_RESOURCES[url].metadata;
          for (const key in expectedMetadata) {
            assert.strictEqual(metadata[key], expectedMetadata[key]);
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  });
});

export class TestApp extends BaseApp implements IApp {
  repository = new SqliteRepository(this);
  fetchRepository = new SqliteFetchRepository(this);
  unfurlRepository = new SqliteUnfurlRepository(this);
  bookmarks = new BookmarksService(this);
  fetch = new FetchService(this);
  unfurl = new UnfurlService(this);

  constructor(testDatabasePath = "data/test/unfurl") {
    super();
    const app = this;
    this.modules.push(
      this.repository,
      this.fetchRepository,
      this.unfurlRepository,
      this.bookmarks,
      this.fetch,
      this.unfurl
    );
    this.config.set("sqliteDatabasePath", testDatabasePath);
  }

  async init() {
    await rimraf(this.config.get("sqliteDatabasePath"));
    return super.init();
  }
}

type TestResources = {
  headers: Record<string, string>;
  body: string;
  metadata: UnfurlMetadata;
};

const TEST_RESOURCES: Record<string, TestResources> = {
  "https://blog.lmorchard.com/2024/09/12/you-wake-up/": {
    headers: {},
    body: `<!DOCTYPE html>
  <html>
    <head>
      <title>You Wake Up - blog.lmorchard.com</title>
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
      <meta property="og:title" content="You Wake Up" />
        <meta
          property="og:url"
          content="https://blog.lmorchard.com/2024/09/12/you-wake-up/"
        />
        <meta
            property="og:image"
            content="https://blog.lmorchard.com/2024/09/12/you-wake-up/cover.png"
          />
        <meta property="og:description" content="TL;DR: A creative writing exercise inspired by getting up too many times last night." />
    </head>
    <body>
      <article
        data-pagefind-body
        class="content content-grid post tag-fictiontag-flashfictiontag-scifi"
      >
        <header>
          <time
            title="2024-09-12T12:00:00+00:00"
            pubdate="2024-09-12T12:00:00+00:00"
          >
            <span class="prevpost">

            </span>
            <span class="postdate">
              <a href="/2024/">2024</a>
              &#8226;
              <a href="/2024/09/">September</a>
              &#8226;
              <span>12</span>
            </span>
            <span class="nextpost">
              <a title="Clustering ideas with Llamafile and Web Components" href="/2024/06/19/topic-clustering-llamafile-web-components/">&nbsp;<span class="fa fa-long-arrow-right"></span>&nbsp;</a>
            </span>
          </time>
        </header>
      </article>
    </body>
  </html>`,
    metadata: {
      author: "Les Orchard",
      date: "2024-09-01T19:00:00.000Z",
      description:
        "TL;DR: A creative writing exercise inspired by getting up too many times last night.",
      image: "https://blog.lmorchard.com/2024/09/12/you-wake-up/cover.png",
      logo: "https://www.gravatar.com/avatar/b45c48fc9e05922e2f368a9d7d7d8de1?s=16",
      publisher: "blog.lmorchard.com",
      title: "You Wake Up",
      url: "https://blog.lmorchard.com/2024/09/12/you-wake-up/",
      feed: "https://blog.lmorchard.com/index.rss",
      //iframe: null,
      //lang: null,
      //video: null,
      //audio: null
    },
  },
};
