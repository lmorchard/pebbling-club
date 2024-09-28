import { IApp } from "../app/types";
import { AppModule } from "../app/modules";
import metascraper from "metascraper";
import { FetchService } from "./fetch";

export const configSchema = {};

export type IAppRequirements = {
  unfurlRepository: IUnfurlRepository;
  fetch: FetchService;
};

export class UnfurlError extends Error {}

export type UnfurlMetadata = {
  cached?: boolean;
  cachedAt?: number;
} & metascraper.Metadata;

export class UnfurlService extends AppModule<IAppRequirements> {
  metascraper: metascraper.Metascraper;

  constructor(app: IApp & IAppRequirements) {
    super(app);

    this.metascraper = metascraper([
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
  }

  async init() {
    const { config } = this.app;
  }

  async fetchMetadata(
    url: string,
    options: {
      forceFetch?: boolean;
      timeout?: number;
      lastHeaders?: Record<string, string>;
      maxage?: number;
    } = {}
  ): Promise<UnfurlMetadata> {
    const { fetch, unfurlRepository } = this.app;
    const { forceFetch = false, timeout = 10000, lastHeaders = {} } = options;

    const cachedMetadata = await unfurlRepository.fetchUnfurlMetadata(url);
    if (cachedMetadata) return cachedMetadata;

    const { metascraper } = this;

    const { response } = await fetch.fetchResource({
      url,
      accept: "text/html",
      timeout,
      forceFetch,
      lastHeaders,
    });

    if (response.status !== 200) {
      throw new UnfurlError(`Failed to unfurl ${url}`);
    }

    // TODO: might need more per-domain hacks here?
    const rules: metascraper.Rules[] = [];
    /*
    if (/patreon\.com/.test(url)) {
      // This seems like a "cheat" to get around cloudflare? Maybe a bad idea
      rules.push(require("metascraper-media-provider")());
    }
    */

    const html = await response.text();
    let metadata = await metascraper({ html, url, rules });

    // If the page is a Cloudflare "Just a moment..." page, just return the URL
    // TODO: do something smarter here
    if (metadata.title === "Just a moment...") {
      metadata = { url };
    }

    return await unfurlRepository.upsertUnfurlMetadata(url, metadata);
  }
}

export interface IUnfurlRepository {
  upsertUnfurlMetadata(
    url: string,
    metadata: UnfurlMetadata
  ): Promise<UnfurlMetadata>;
  fetchUnfurlMetadata(url: string): Promise<UnfurlMetadata | null>;
}
