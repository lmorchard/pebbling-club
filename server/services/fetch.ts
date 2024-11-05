import * as Undici from "undici";
import PQueue from "p-queue";
import { IApp } from "../app/types";
import { AppModule } from "../app/modules";
import { IncomingHttpHeaders } from "undici/types/header";
import BodyReadable from "undici/types/readable";

export const configSchema = {
  fetchTimeout: {
    doc: "timeout in milliseconds for fetching a resource",
    env: "FETCH_TIMEOUT",
    format: Number,
    default: 10000,
  },
  fetchEnableCache: {
    doc: "whether to enable cache for resource fetches",
    env: "FETCH_ENABLE_CACHE",
    format: Boolean,
    default: true,
  },
  fetchCacheMaxage: {
    doc: "timeout in milliseconds for fetching a resource",
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
  fetchMaxResponseSize: {
    doc: "maximum acceptable response size in bytes",
    env: "FETCH_MAX_RESPONSE_SIZE",
    format: Number,
    default: 1024 * 1024 * 2, // 2MB
  },
  userAgent: {
    doc: "User-Agent header to send with fetch requests.",
    format: String,
    default: "PebblingClub/1.0",
  },
};

export interface IFetchRepository {
  upsertResponse(
    url: string | URL,
    response: FetchResponse
  ): Promise<FetchResponse>;
  fetchResponse(url: string | URL): Promise<FetchResponseFromCache | undefined>;
  clearCachedResponses(): Promise<void>;
}

export type FetchOptions = {
  url: string | URL;
  headers?: Record<string, string>;
  maxage?: number;
  lastHeaders?: Record<string, string>;
  timeout?: number;
  maxResponseSize?: number;
  forceFetch?: boolean;
  userAgent?: string;
  accept?: string;
  controller?: AbortController;
  enableCache?: boolean;
};

export interface FetchResponse {
  status: number;
  headers?: IncomingHttpHeaders;
  body?: BodyReadable;
}

export interface FetchResponseFromCache extends FetchResponse {
  cached?: boolean;
  cachedAt?: number;
}

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

  async fetchResource(options: FetchOptions): Promise<FetchResponseFromCache> {
    return this.fetchQueue.add(
      async () => this.fetchResourceImmediately(options),
      { throwOnTimeout: true }
    );
  }

  async fetchResourceImmediately({
    url,
    headers,
    lastHeaders = {},
    accept = "text/html",
    forceFetch = false,
    controller = new AbortController(),
    userAgent = this.app.config.get("userAgent"),
    maxage = this.app.config.get("fetchCacheMaxage"),
    timeout = this.app.config.get("fetchTimeout"),
    maxResponseSize = this.app.config.get("fetchMaxResponseSize"),
    enableCache = this.app.config.get("fetchEnableCache"),
  }: FetchOptions): Promise<FetchResponseFromCache> {
    const { log } = this;

    if (enableCache) {
      const cachedResponse = await this.app.fetchRepository.fetchResponse(url);
      if (cachedResponse) {
        const now = Date.now();
        const { cachedAt = now } = cachedResponse;
        const age = now - cachedAt;
        const logCommon = { url, age };
        if (age < maxage) {
          log.trace({ msg: "Using cached response", ...logCommon });
          return { ...cachedResponse, cached: true };
        } else {
          log.trace({ msg: "Cached response too old", ...logCommon });
        }
      }
    }

    // Set up an abort timeout - we're not waiting forever
    const abortTimeout = setTimeout(() => controller.abort(), timeout);

    const requestHeaders: Record<string, string> = {
      "user-agent": userAgent,
      accept,
      ...headers,
    };

    if (!forceFetch) {
      // Set up some headers for conditional GET so we can see
      // some of those sweet 304 Not Modified responses
      if (lastHeaders.etag) requestHeaders["If-None-Match"] = lastHeaders.etag;
      if (lastHeaders["last-modified"])
        requestHeaders["If-Modified-Match"] = lastHeaders["last-modified"];
    }

    try {
      log.trace({ msg: "start fetchResource", url });
      const responseData = await Undici.request(url, {
        method: "GET",
        headers: requestHeaders,
        throwOnError: true,
        headersTimeout: timeout,
        bodyTimeout: timeout,
        signal: controller.signal,
        /* TODO: debug why the event thrown by this is uncatchable?
        dispatcher: new Undici.Agent({
          maxResponseSize,
        }),
        */
      });
      clearTimeout(abortTimeout);
      log.trace({
        msg: "end fetchResource",
        url,
        status: responseData.statusCode,
      });

      const { statusCode, headers, body } = responseData;
      const response = {
        status: statusCode,
        headers,
        body,
      };

      return !enableCache
        ? response
        : this.app.fetchRepository.upsertResponse(url, response);
    } catch (error: any) {
      clearTimeout(abortTimeout);
      if (error.type === "aborted") {
        return { status: 408 };
      }
      log.debug({ msg: "Fetch failed", err: error });
      throw error;
    }
  }
}
