import fetch, { Response } from "node-fetch";
import PQueue from "p-queue";
import { IApp } from "../app/types";
import { AppModule } from "../app/modules";

export const configSchema = {
  fetchTimeout: {
    doc: "timeout in milliseconds for fetching a resource.",
    env: "FETCH_TIMEOUT",
    format: Number,
    default: 10000,
  },
  fetchCacheMaxage: {
    doc: "timeout in milliseconds for fetching a resource.",
    env: "FETCH_CACHE_MAXAGE",
    format: Number,
    default: 1000 * 60 * 15,
  },
  fetchMaxConcurrency: {
    doc: "maximum number of web fetches to perform in parallel",
    env: "FETCH_MAX_CONCURRENCY",
    format: Number,
    default: 64,
  },
  userAgent: {
    doc: "User-Agent header to send with fetch requests.",
    format: String,
    default: "PebblingClub/1.0",
  },
};

export interface IFetchRepository {
  upsertResponse(url: string | URL, response: Response): Promise<Response>;
  fetchResponse(
    url: string | URL
  ): Promise<{ response: Response; cachedAt: number } | undefined>;
  clearCachedResponses(): Promise<void>;
}

export type FetchOptions = {
  url: string | URL;
  headers?: Record<string, string>;
  maxage?: number;
  lastHeaders?: Record<string, string>;
  timeout?: number;
  forceFetch?: boolean;
  userAgent?: string;
  accept?: string;
  controller?: AbortController;
  skipCache?: boolean;
};

export type FetchResponse = {
  response: Response;
  meta: {
    cached: boolean;
    cachedAt?: number;
  };
};

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type IAppRequirements = {
  fetchRepository: IFetchRepository;
};

export class FetchService extends AppModule<IAppRequirements> {
  fetchQueue: PQueue;

  constructor(app: IApp & IAppRequirements) {
    super(app);
    this.fetchQueue = new PQueue({ concurrency: 4 });
  }

  async init() {
    const { config } = this.app;
    this.fetchQueue.concurrency = config.get("fetchMaxConcurrency");
  }

  // TODO: add purgeStaleCachedResources() to delete resources past maxage

  async clearCachedResources() {
    await this.app.fetchRepository.clearCachedResponses();
  }

  async fetchResource(options: FetchOptions): Promise<FetchResponse> {
    const result = await this.fetchQueue.add(async () =>
      this.fetchResourceImmediately(options)
    );
    if (result) return result;
    throw new FetchError("queued fetch failed");
  }

  async fetchResourceImmediately({
    url,
    headers,
    lastHeaders = {},
    maxage = this.app.config.get("fetchCacheMaxage"),
    timeout = this.app.config.get("fetchTimeout"),
    forceFetch = false,
    userAgent = this.app.config.get("userAgent"),
    accept = "application/rss+xml, text/rss+xml, text/xml",
    controller = new AbortController(),
    skipCache,
  }: FetchOptions): Promise<FetchResponse> {
    const { log } = this;

    if (!skipCache) {
      const cachedResponse = await this.app.fetchRepository.fetchResponse(url);
      if (cachedResponse) {
        const { response, cachedAt } = cachedResponse;
        const now = Date.now();
        const age = now - cachedAt;
        const logCommon = {
          age,
          maxage,
          cachedAt,
          now,
        };
        if (age < maxage) {
          log.trace({ msg: "Using cached response", ...logCommon });
          return { response, meta: { cached: true, cachedAt } };
        } else {
          log.trace({ msg: "Cached response too old", ...logCommon });
        }
      }
    }

    // Set up an abort timeout - we're not waiting forever
    const abortTimeout = setTimeout(() => controller.abort(), timeout);

    const fetchOptions = {
      signal: controller.signal,
      method: "GET",
      headers: {
        "user-agent": userAgent,
        accept,
        ...headers,
      } as Record<string, string>,
    };

    // Set up some headers for conditional GET so we can see
    // some of those sweet 304 Not Modified responses
    if (!forceFetch) {
      if (lastHeaders.etag) {
        fetchOptions.headers["If-None-Match"] = lastHeaders.etag;
      }
      if (lastHeaders["last-modified"]) {
        fetchOptions.headers["If-Modified-Match"] =
          lastHeaders["last-modified"];
      }
    }

    try {
      // Finally, fire off the GET request for the feed resource.
      log.trace({ msg: "start fetchResource", url });
      const response = await fetch(url, fetchOptions);
      log.trace({ msg: "end fetchResource", url, status: response.status });
      clearTimeout(abortTimeout);
      return {
        response: skipCache
          ? response
          : await this.app.fetchRepository.upsertResponse(url, response),
        meta: { cached: false },
      };
    } catch (error: any) {
      clearTimeout(abortTimeout);
      if (error.type === "aborted") {
        return {
          response: await this.app.fetchRepository.upsertResponse(
            url,
            new Response(null, { status: 408, statusText: "timeout" })
          ),
          meta: { cached: false },
        };
      }
      log.debug({ msg: "Fetch failed", err: error });
      throw error;
    }
  }
}
