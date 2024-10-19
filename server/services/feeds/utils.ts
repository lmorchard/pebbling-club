import crypto from "crypto";
import FeedParser, { Meta, Item } from "feedparser";
import { Feed } from "./types";
import iconv from "iconv-lite";
import { FetchResponse } from "../fetch";

// Relevant date for an item has a bit of variance, so let's
// work with some fallbacks. Also, treat future dates as *now*,
// since I've seen a few feeds behave badly that way.
export const itemDate = ({ date, pubdate }: FeedParser.Item) => {
  const now = new Date();
  const candidate = new Date(date || pubdate || now);
  return candidate < now ? candidate : now;
};

// Some items don't have a guid, so let's use a hash of the
// title & link as a rough fallback
export const itemGuid = ({ guid, title = "", link = "" }: FeedParser.Item) =>
  guid || crypto.createHash("md5").update(title).update(link).digest("hex");

export const parseFeedStream = (stream: NodeJS.ReadableStream, url: string) =>
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

export function normalizeFeedCharset(response: FetchResponse, feed: Feed) {
  const charset = detectCharsetFromFeed(response, feed);
  let stream: NodeJS.ReadableStream = response.body!;
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

export function detectCharsetFromFeed(response: FetchResponse, feed: Feed) {
  const contentType = "" + response.headers?.["content-type"];
  const contentTypeParams = getContentTypeParams(contentType);
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

export function getContentTypeParams(str: string) {
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
