import assert from "assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { TestApp } from "../utils/test";

describe("services/bookmarks", () => {
  const username = "johndoe";
  const password = "hunter23";

  let app: TestApp;
  let profileId: string;

  beforeEach(async () => {
    app = new TestApp("data/test/bookmarks");
    await app.init();
    profileId = await app.profiles.create({ username }, { password });
  });

  afterEach(async () => {
    await app.deinit();
  });

  describe("normalizeUrlForHash", () => {
    it("should normalize URLs for hashing", async () => {
      for (const [testUrl, { expected }] of Object.entries(TEST_URLS)) {
        const normalized = await app.bookmarks.normalizeUrlForHash(testUrl);
        assert.equal(normalized, expected);
      }
    });
  });

  describe("generateUrlHash", () => {
    it("should generate URL hashes for normalized URLs", async () => {
      for (const [testUrl, { hashNormalized }] of Object.entries(TEST_URLS)) {
        const resultHash = await app.bookmarks.generateUrlHash(testUrl, true);
        assert.equal(resultHash, hashNormalized);
      }
    });
    it("should generate URL hashes for raw URLs", async () => {
      for (const [testUrl, { hashRaw }] of Object.entries(TEST_URLS)) {
        const resultHash = await app.bookmarks.generateUrlHash(testUrl, false);
        assert.equal(resultHash, hashRaw);
      }
    });
  });

  const bookmarkData = {
    href: "http://example.com",
    title: "Example",
    extended: "An example bookmark",
    tags: ["test", "foo", "bar", "baz"],
  };

  describe("upsert", () => {
    it("should create a new bookmark", async () => {
      const bookmark = await app.bookmarks.upsert({
        ownerId: profileId,
        ...bookmarkData,
      });
      assert.ok(bookmark != null);
      assert.equal(bookmark.href, bookmarkData.href);
      assert.equal(bookmark.title, bookmarkData.title);
      assert.equal(bookmark.extended, bookmarkData.extended);
      assert.equal(bookmark.tags?.length, 4);

      const fetched = await app.bookmarks.get(profileId, bookmark.id);
      assert.ok(fetched != null);
      assert.equal(fetched.href, bookmarkData.href);
      assert.equal(fetched.title, bookmarkData.title);
      assert.equal(fetched.extended, bookmarkData.extended);
      assert.equal(fetched.tags?.length, 4);
    });
  });

  describe("update", () => {
    it("should partly update a bookmark without clobbering unaffected fields", async () => {
      const bookmark = await app.bookmarks.upsert({
        ownerId: profileId,
        ...bookmarkData,
      });

      const updated = await app.bookmarks.update({
        id: bookmark.id,
        title: "Updated",
      });
      assert.equal(updated.title, "Updated");
      assert.equal(updated.extended, bookmarkData.extended);
      assert.equal(updated.tags?.length, 4);
      assert.equal(updated.tags?.length, bookmarkData.tags.length);

      const fetched = await app.bookmarks.get(profileId, bookmark.id);
      assert.ok(fetched != null);
      assert.equal(fetched.title, "Updated");
      assert.equal(fetched.extended, bookmarkData.extended);
      assert.equal(fetched.tags?.length, bookmarkData.tags.length);
    });
  });
});

const TEST_URLS = {
  "http://abcnews.go.com/US/wireStory?id=201062&CMP=OTC-RSSFeeds0312": {
    expected:
      "http://abcnews.go.com/US/wireStory?CMP=OTC-RSSFeeds0312&id=201062",
    hashNormalized:
      "3cb77dfd0b55f352d1308e36c331cf1944f7a52bfc1c5c678e657b8cdae2a513",
    hashRaw: "823134feebb17065ea6661e6b97818f993a4895b3c35d74dbcd0079cd9526133",
  },
  "http://an9.org/devdev/why_frameworks_suck?sxip-homesite=&checked=1": {
    expected:
      "http://an9.org/devdev/why_frameworks_suck?checked=1&sxip-homesite=",
    hashNormalized:
      "77824552f46b1ef128eb071471d9d2d3f2230e43416e6139dc6ff3543d744ae4",
    hashRaw: "38b95d8027a2af4054d2bee88759a256910d443b3f5d50b45143957b5196703a",
  },
  "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project/":
    {
      expected:
        "https://hackaday.com/2023/08/29/retro-gadgets-the-1974-breadboard-project",
      hashNormalized:
        "e230e98b58025985b304e44c15b1cafbc1be8ac04a0bc8697b240c219daf4202",
      hashRaw:
        "8767d543dc32eced6500d2003df066f6b7d5f0ec27d2630cc85ca61d1e594404",
    },
  "http://annearchy.com/blog/?p=3661": {
    expected: "http://annearchy.com/blog?p=3661",
    hashNormalized:
      "ea381473fe8abd34466fe188489c94f09118a8fde58eee7a40f4b697e610bf55",
    hashRaw: "5a89b8d16420ffd6ffed365eb42b33ca31b69b7045def754ed191ba5a7b31991",
  },
  "http://mashable.com/2013/08/11/teens-facebook/?utm_cid=mash-prod-email-topstories":
    {
      expected: "http://mashable.com/2013/08/11/teens-facebook",
      hashNormalized:
        "92b45937db1811258532614c4f5c7972a4f98f560ca7cfdd74718b9b8d8324ac",
      hashRaw:
        "99221f31b5b03f38767dea3c7027ffab37ae4e89ccebb90a55de3b5ac46aa4dd",
    },
  "http://bash.org/?564283": {
    expected: "http://bash.org/?564283=",
    hashNormalized:
      "ef09bd480d9624fea0dcb3f49ae02250e59682165895f2075e03d091a9208e3d",
    hashRaw: "1e8816aa135c234407b31c2e12e291d5448492a82687f06cfe82add8c0887cf2",
  },
} as const;
