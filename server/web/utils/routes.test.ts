import assert from "assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  parseBookmarkListOptions,
  serializeBookmarkListOptions,
} from "./routes";

describe("utils/routes", () => {
  describe("parseBookmarkListOptions", () => {
    it("should parse querystring options", () => {
      const query = {
        show: "notes,feed,embed,unfurl",
        open: "notes",
        q: "example",
        limit: "25",
        offset: "50",
      };
      const result = parseBookmarkListOptions(query);
      assert.deepStrictEqual(result, {
        show: ["notes", "feed", "embed", "unfurl"],
        open: "notes",
        q: "example",
        limit: 25,
        offset: 50,
      });
    });

    it("should apply defaults", () => {
      const query = {
        show: "notes,feed,embed,unfurl",
        open: "notes",
        q: "example",
      };
      const result = parseBookmarkListOptions(query);
      assert.deepStrictEqual(result, {
        show: ["notes", "feed", "embed", "unfurl"],
        open: "notes",
        q: "example",
        limit: 50,
        offset: 0,
      });
    });
  });

  describe("serializeBookmarkListOptions", () => {
    it("should serialize non-default options", () => {
      const options = {
        show: ["notes", "feed", "embed", "unfurl"],
        open: "notes",
        q: "example",
        limit: 25,
        offset: 50,
      };
      const result = serializeBookmarkListOptions(options);
      assert.deepStrictEqual(result, {
        q: "example",
        limit: "25",
        offset: "50",
      });
    });

    it("should not serialize default options", () => {
      const options = {
        show: ["notes", "feed", "embed", "unfurl"],
        open: "notes",
        q: "example",
        limit: 50,
        offset: 0,
      };
      const result = serializeBookmarkListOptions(options);
      assert.deepStrictEqual(result, {
        q: "example",
      });
    });
  });
});
