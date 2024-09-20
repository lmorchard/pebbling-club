import { describe, it, beforeEach, afterEach } from "node:test";
import { TestApp, buildReadableStreamFromString } from "../../utils/test";
import { commonImportTest } from "./test-utils";
import assert from "assert";

describe("services/imports/opml", () => {
  const username = "johndoe";
  const password = "hunter23";

  let app: TestApp;
  let profileId: string;

  beforeEach(async () => {
    app = new TestApp("data/test/imports/opml");
    await app.init();
    profileId = await app.profiles.create({ username }, { password });
  });

  afterEach(async () => {
    await app.deinit();
  });

  it("importOpml should import from OPML with idempotency", async () => {
    await commonImportTest(app, profileId, TEST_URLS, () =>
      app.imports.importOPML(
        profileId,
        10,
        buildReadableStreamFromString(TEST_OPML)
      )
    );

    const { bookmarks } = app;

    for (const url of TEST_URLS) {
      const result = await bookmarks.getByUrl(profileId, url);
      assert.ok(result !== null, `bookmark should exist for ${url}`);

      const { tags = [] } = result!;
      assert.ok(
        tags.includes("imported:opml"),
        `bookmark should have tag imported:opml`
      );

      assert.equal(
        result.meta?.opml?.type,
        "rss",
        "bookmark should retain opml node properties in meta.opml"
      );
    }
  });
});

const TEST_OPML = `
<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>XOXO feeds</title>
  </head>
  <body>
    <outline text="XOXO" title="XOXO">
      <outline text="blog.lmorchard.com" title="blog.lmorchard.com" type="rss" xmlUrl="https://blog.lmorchard.com/index.rss" htmlUrl="https://blog.lmorchard.com/"/>
      <outline text="Brad Barrish" title="Brad Barrish" type="rss" xmlUrl="https://bradbarrish.com/feed/" htmlUrl="https://bradbarrish.com/"/>
      <outline text="Bricolagerie" title="Bricolagerie" type="rss" xmlUrl="https://bricolagerie.blog/feed/" htmlUrl="https://bricolagerie.blog/"/>
      <outline text="Chris Koerner" title="Chris Koerner" type="rss" xmlUrl="https://clkoerner.com/feed/" htmlUrl="https://clkoerner.com"/>
      <outline text="Citation Needed" title="Citation Needed" type="rss" xmlUrl="https://www.citationneeded.news/rss/" htmlUrl="https://www.citationneeded.news/"/>
   </outline>
  </body>
</opml>
`.trim();

const TEST_URLS = [
  "https://blog.lmorchard.com/",
  "https://bradbarrish.com/",
  "https://bricolagerie.blog/",
  "https://clkoerner.com",
  "https://www.citationneeded.news/",
];
