import { FeedsService } from ".";
import { FeedDiscovered, FeedAutodiscoverError, FEED_TYPES, FeedType } from "./types";
import { WritableStream as HTMLWritableStream } from "htmlparser2/lib/WritableStream";

export async function autodiscover(this: FeedsService, url: string, options: { forceFetch?: boolean } = {}) {
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
  const response = await fetch.fetchResource({ url, controller });
  if (!response || response.status !== 200) {
    throw new FeedAutodiscoverError(
      "failed to fetch resource",
      undefined,
      response?.status
    );
  }

  const contentTypeHeader = response.headers?.["content-type"];
  if (typeof contentTypeHeader === "string") {
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