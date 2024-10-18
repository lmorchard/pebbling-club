import { AppModule } from "../../app/modules";
import createMetascraper from "metascraper";
import { FetchService } from "../fetch";
import PQueue from "p-queue";
import {
  BookmarksService,
  BookmarkUpdatableWithHash,
  BookmarkWithPermissions,
} from "../bookmarks";

export type IAppRequirements = {
  unfurlRepository: IUnfurlRepository;
  fetch: FetchService;
  bookmarks: BookmarksService;
};

export const configSchema = {
  unfurlConcurrency: {
    doc: "maximum number of unfurls to perform in parallel",
    env: "UNFURL_CONCURRENCY",
    format: Number,
    default: 64,
  },
  unfurlMaxContentLength: {
    doc: "maximum size of bytes to accept from fetched URL for unfurl",
    env: "UNFURL_MAX_CONTENT_LENGTH",
    format: Number,
    default: 1024 * 1024 * 2, // 2MB
  },
  unfurlTimeout: {
    doc: "maximum time in ms for unfurl requests",
    env: "UNFURL_TIMEOUT",
    format: Number,
    default: 1000 * 10,
  },
  unfurlMaxage: {
    doc: "maximum age in ms for cached unfurl results",
    env: "UNFURL_CACHE_MAXAGE",
    format: Number,
    default: 1000 * 60 * 60 * 24, // 1 day
  },
};

export class UnfurlError extends Error {
  result: UnfurlResult;
  constructor(message: string, result: UnfurlResult) {
    super(message);
    this.result = result;
  }
}

// based on createMetascraper.Metadata, but didn't want every value to be string
export type UnfurlResult = {
  cached?: boolean;
  cachedAt?: number;
  duration?: number;
  expires?: number;
  status?: number;
  contentLength?: string;
  bodyLength?: number;
  error?: any;
  errorMessage?: string;

  audio?: string;
  author?: string;
  date?: string;
  description?: string;
  image?: string;
  lang?: string;
  logo?: string;
  publisher?: string;
  title?: string;
  url?: string;
  video?: string;

  [key: string]: boolean | number | string | undefined;
};

export type FetchMetadataOptions = {
  forceFetch?: boolean;
  timeout?: number;
  maxage?: number;
};

export class UnfurlService extends AppModule<IAppRequirements> {
  queue = new PQueue({ throwOnTimeout: true });

  metascraper = createMetascraper([
    require("metascraper-author")(),
    require("metascraper-date")(),
    require("metascraper-description")(),
    require("metascraper-image")(),
    require("metascraper-logo")(),
    require("metascraper-logo-favicon")(),
    require("metascraper-publisher")(),
    require("metascraper-title")(),
    require("metascraper-url")(),
    require("metascraper-feed")(),
    require("metascraper-iframe")(),
    require("metascraper-lang")(),
    require("metascraper-amazon")(),
    require("metascraper-instagram")(),
    require("metascraper-soundcloud")(),
    require("metascraper-spotify")(),
    require("metascraper-youtube")(),
  ]);

  async init() {
    const { config } = this.app;
    this.queue.concurrency = config.get("unfurlConcurrency");
    this.queue.timeout = config.get("unfurlTimeout");
    return super.init();
  }

  async fetchMetadata(
    url: string,
    options: FetchMetadataOptions = {}
  ): Promise<UnfurlResult> {
    return await this.queue.add(
      async () => this.fetchMetadataImmediately(url, options),
      { throwOnTimeout: true }
    );
  }

  async fetchMetadataImmediately(
    url: string,
    options: FetchMetadataOptions = {}
  ): Promise<UnfurlResult> {
    const { config, unfurlRepository, fetch } = this.app;
    const { metascraper } = this;
    const {
      forceFetch = false,
      timeout = config.get("unfurlTimeout") as number,
      maxage = config.get("unfurlMaxage") as number,
    } = options;

    const now = Date.now();

    const handleResult = (result: UnfurlResult) => {
      if (result.error) {
        // re-throw the error if encountered
        const message =
          result.error instanceof Error
            ? result.error.message
            : "unfurl failed";
        throw new UnfurlError(message, result);
      }
      return result;
    };

    if (!forceFetch) {
      const cachedResult = await unfurlRepository.fetchUnfurlMetadata(url);
      const expires = cachedResult?.expires;
      if (expires && expires > now) return handleResult(cachedResult);
    }

    const result: UnfurlResult = { expires: now + maxage };

    try {
      const response = await fetch.fetchResource({
        url,
        accept: "application/rss+xml, text/rss+xml, text/xml",
        maxResponseSize: config.get("unfurlMaxContentLength"),
        timeout,
        forceFetch,
        enableCache: forceFetch,
      });

      const { status, headers } = response;
      const contentLength = headers?.["Content-Length"]?.toString();
      Object.assign(result, { status, contentLength });

      const html = await response.body?.text();
      if (response.status !== 200 || !html) {
        throw Error(`fetch status not 200 OK`);
      }

      result.bodyLength = html.length;

      // TODO: need more per-domain hacks here
      const rules: createMetascraper.Rules[] = [];
      let metadata = await metascraper({ html, url, rules });

      if (metadata.title === "Just a moment...") {
        // If the page is a Cloudflare "Just a moment..." page, just return the URL
        // TODO: do something smarter here
        metadata = { url };
      }

      // Copy metascraper metadata into result
      Object.assign(result, {
        ...metadata,
        duration: Date.now() - now,
      });
    } catch (err) {
      result.error = err;
      if (err instanceof Error) {
        result.errorMessage = err.message;
      }
    }

    return handleResult(
      await unfurlRepository.upsertUnfurlMetadata(url, result)
    );
  }

  async backfillMetadataForBookmarks(options: {
    ownerId: string;
    batchSize?: number;
    unfurlTimeout?: number;
    forceFetch?: boolean;
    forceUpdate?: boolean;
    skipUpdateOnError?: boolean;
  }) {
    const { log } = this;
    const { bookmarks, config } = this.app;
    const {
      ownerId,
      batchSize = config.get("unfurlConcurrency"),
      unfurlTimeout = config.get("unfurlTimeout"),
      forceFetch = false,
      forceUpdate = false,
      skipUpdateOnError = true,
    } = options;

    const unfurlQueue = new PQueue({
      concurrency: batchSize,
      timeout: unfurlTimeout,
      throwOnTimeout: true,
    });

    const updateQueue = new PQueue({ concurrency: 1 });

    const inFlight = new Map<string, number>();

    let offset = 0;
    let total: null | number = null;

    const startTime = Date.now();

    const statusInterval = setInterval(() => {
      const now = Date.now();
      const duration = now - startTime;
      const durationPerItem = duration / offset;
      const estimateEndDuration = total ? total * durationPerItem : 0;

      log.info({
        msg: "backfillStatus",
        progress: total && ((offset / total) * 100).toFixed(2),
        secondsRemaining:
          total && ((estimateEndDuration - duration) / 1000).toFixed(2),
        duration,
        estimateEndDuration: estimateEndDuration.toFixed(2),
        durationPerItem: durationPerItem.toFixed(2),
        offset,
        total,
      });

      log.debug({
        msg: "backfillQueueStatus",
        unfurlSize: unfurlQueue.size,
        unfurlPending: unfurlQueue.pending,
        updateSize: updateQueue.size,
        updatePending: updateQueue.pending,
      });

      log.trace({
        msg: "backfillInflightStatus",
        inFlightSize: inFlight.size,
        inFlightUrls: Array.from(inFlight.entries()).map(
          ([url, time]) =>
            `${(Date.now() - time).toString().padStart(6, " ")} ${url}`
        ),
      });
    }, 1000);

    type UnfurlResultWithFailure =
      | UnfurlResult
      | {
          failed?: boolean;
          failedAt?: number;
          failedError?: any;
        };

    const enqueueUnfurl = async (item: BookmarkWithPermissions) => {
      const url = item.href;
      unfurlQueue
        .add(async () => {
          log.trace({ msg: "unfurling", url });
          inFlight.set(url, Date.now());
          return await this.fetchMetadata(url, {
            timeout: unfurlTimeout,
            forceFetch,
          });
        })
        .then((unfurlResult) => {
          log.trace({ msg: "unfurled", url });
          inFlight.delete(url);
          enqueueUpdate(item, unfurlResult!);
        })
        .catch((err) => {
          log.trace({ msg: "unfurl failed", url, err });
          inFlight.delete(url);
          if (!skipUpdateOnError) {
            if (err instanceof UnfurlError) {
              enqueueUpdate(item, err.result);
            } else {
              enqueueUpdate(item, {
                failed: true,
                failedAt: Date.now(),
                failedError: err.toString(),
              });
            }
          }
        });
    };

    const batchBuffer: BookmarkUpdatableWithHash[] = [];

    const enqueueUpdate = async (
      item: BookmarkWithPermissions,
      unfurlResult: UnfurlResultWithFailure
    ) => {
      batchBuffer.push({
        id: item.id,
        meta: { unfurl: unfurlResult },
      });
      if (batchBuffer.length >= batchSize) {
        enqueueCommitUpdateBatch();
      }
    };

    const enqueueCommitUpdateBatch = async (size: number = batchSize) => {
      const batch = batchBuffer.splice(0, size);
      updateQueue.add(async () => {
        try {
          log.trace({ msg: "commit start", size });
          await bookmarks.updateBatch(batch);
          log.trace({ msg: "commit", size });
        } catch (err) {
          log.warn({ msg: "commit failed", err });
        }
      });
      log.trace({ msg: "commit enqueued", size });
    };

    while (total == null || offset < total) {
      log.trace({ msg: "fetching bookmarks", offset, batchSize });

      const result = await bookmarks.listForOwner(
        ownerId,
        ownerId,
        batchSize,
        offset
      );
      if (!result || result.items.length === 0) break;

      for (const item of result.items) {
        if (item.meta?.unfurl && !forceFetch && !forceUpdate) {
          log.trace({ msg: "skip unfurling", url: item.href });
          continue;
        }
        enqueueUnfurl(item);
      }

      total = result.total;
      offset += batchSize;

      // Pause between fetching batches of bookmarks to let queues drain
      await unfurlQueue.onEmpty();
      await this.queue.onEmpty();
      await updateQueue.onEmpty();
    }

    // Wait until the unfurl queues have entirely finished
    await unfurlQueue.onIdle();
    await this.queue.onIdle();

    // Commit the final incomplete batch.
    await enqueueCommitUpdateBatch();
    await updateQueue.onIdle();

    clearInterval(statusInterval);
  }
}

export interface IUnfurlRepository {
  upsertUnfurlMetadata(
    url: string,
    metadata: UnfurlResult
  ): Promise<UnfurlResult>;
  fetchUnfurlMetadata(url: string): Promise<UnfurlResult | null>;
}
