import { IApp } from "../app/types";
import { AppModule } from "../app/modules";
import createMetascraper from "metascraper";
import { FetchService } from "./fetch";
import axios from "axios";
import {
  BookmarksService,
  BookmarkUpdatableWithHash,
  BookmarkWithPermissions,
} from "./bookmarks";
import PQueue from "p-queue";

export const configSchema = {};

export type IAppRequirements = {
  unfurlRepository: IUnfurlRepository;
  fetch: FetchService;
  bookmarks: BookmarksService;
};

export class UnfurlError extends Error {}

export type UnfurlMetadata = {
  cached?: boolean;
  cachedAt?: number;
} & createMetascraper.Metadata;

export class UnfurlService extends AppModule<IAppRequirements> {
  async fetchMetadata(
    url: string,
    options: {
      forceFetch?: boolean;
      skipFetchCache?: boolean;
      timeout?: number;
      lastHeaders?: Record<string, string>;
      maxage?: number;
    } = {}
  ): Promise<UnfurlMetadata> {
    const { fetch, unfurlRepository } = this.app;
    const {
      forceFetch = false,
      // TODO: make this configurable
      skipFetchCache = true,
      timeout = 10000,
      lastHeaders = {},
    } = options;

    if (!forceFetch) {
      const cachedMetadata = await unfurlRepository.fetchUnfurlMetadata(url);
      if (cachedMetadata) return cachedMetadata;
    }

    const metascraper = createMetascraper([
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
      // require("metascraper-youtube")(),
    ]);

    const response = await axios.get<string>(url, {
      responseType: "text",
      timeout,
      maxBodyLength: 1024 * 512,
      maxContentLength: 1024 * 512,
      headers: {
        accept: "text/html",
      },
    });

    if (response.status !== 200) {
      throw new UnfurlError(`Failed to unfurl ${url}`);
    }

    // TODO: might need more per-domain hacks here?
    const rules: createMetascraper.Rules[] = [];
    /*
    if (/patreon\.com/.test(url)) {
      // This seems like a "cheat" to get around cloudflare? Maybe a bad idea
      rules.push(require("metascraper-media-provider")());
    }
    */

    const html = response.data;
    let metadata = await metascraper({ html, url, rules });

    // If the page is a Cloudflare "Just a moment..." page, just return the URL
    // TODO: do something smarter here
    if (metadata.title === "Just a moment...") {
      metadata = { url };
    }

    return forceFetch
      ? metadata
      : await unfurlRepository.upsertUnfurlMetadata(url, metadata);
  }

  async backfillMetadataForBookmarks({
    ownerId,
    batchSize = 64,
    unfurlTimeout = 10000,
    forceFetch = false,
  }: {
    ownerId: string;
    batchSize?: number;
    unfurlTimeout?: number;
    forceFetch?: boolean;
  }) {
    const { log } = this;
    const { bookmarks, fetch } = this.app;

    const unfurlQueue = new PQueue({
      concurrency: batchSize,
      timeout: unfurlTimeout,
      throwOnTimeout: true,
    });

    const updateQueue = new PQueue({ concurrency: 1 });

    let offset = 0;
    let total: null | number = null;

    const startTime = Date.now();

    const statusInterval = setInterval(() => {
      const now = Date.now();
      const duration = now - startTime;
      const durationPerItem = duration / offset;
      const estimateEndDuration = total ? total * durationPerItem : 0;

      log.info({
        msg: "queue",
        progress: total && ((offset / total) * 100).toFixed(2),
        secondsRemaining:
          total && ((estimateEndDuration - duration) / 1000).toFixed(2),
        duration,
        durationPerItem: durationPerItem.toFixed(2),
        estimateEndDuration: estimateEndDuration.toFixed(2),
        offset,
        batchSize,
        total,
        unfurlSize: unfurlQueue.size,
        unfurlPending: unfurlQueue.pending,
        updateSize: updateQueue.size,
        updatePending: updateQueue.pending,
        fetchSize: fetch.fetchQueue.size,
        fetchPending: fetch.fetchQueue.pending,
      });
    }, 1000);

    type UnfurlResult =
      | UnfurlMetadata
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
          return await this.fetchMetadata(url, {
            timeout: unfurlTimeout,
          });
        })
        .then((unfurlResult) => {
          log.trace({ msg: "unfurled", url });
          enqueueUpdate(item, unfurlResult!);
        })
        .catch((err) => {
          log.trace({ msg: "unfurl failed", url, err });
          enqueueUpdate(item, {
            failed: true,
            failedAt: Date.now(),
            failedError: err.toString(),
          });
        });
    };

    const batchBuffer: BookmarkUpdatableWithHash[] = [];

    const enqueueUpdate = async (
      item: BookmarkWithPermissions,
      unfurlResult: UnfurlResult
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
        if (item.meta?.unfurl && !forceFetch) {
          log.trace({ msg: "skip unfurling", url: item.href });
          continue;
        }
        enqueueUnfurl(item);
      }

      total = result.total;
      offset += batchSize;

      // Pause between fetching batches of bookmarks to let queues drain
      await unfurlQueue.onEmpty();
      await updateQueue.onEmpty();
    }

    // Commit the final incomplete batch.
    await enqueueCommitUpdateBatch();

    // Wait until the queues have entirely finished
    await unfurlQueue.onIdle();
    await updateQueue.onIdle();

    clearInterval(statusInterval);
  }
}

export interface IUnfurlRepository {
  upsertUnfurlMetadata(
    url: string,
    metadata: UnfurlMetadata
  ): Promise<UnfurlMetadata>;
  fetchUnfurlMetadata(url: string): Promise<UnfurlMetadata | null>;
}
