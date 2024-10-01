import { LitElement, html, render } from "lit";
import BatchQueue from "../utils/batch-queue";
import linkSvg from "@common/svg/link";

import "./pc-bookmark.css";

export default class PCBookmarkElement extends LitElement {
  isLoading: boolean;
  hasFeed: boolean;
  feedUrl?: string;
  feedFetched?: boolean;
  actionsTemplate: (data: any) => any;

  static get properties() {
    return {
      isLoading: { type: Boolean },
      hasFeed: { type: Boolean },
      feedUrl: { type: String },
      feedFetched: { type: Object },
    };
  }

  constructor() {
    super();

    this.isLoading = false;
    this.hasFeed = false;
    this.feedUrl = undefined;
    this.feedFetched = undefined;

    this.actionsTemplate = (data) => html`
      <span>moar actions - ${data.title}</span>
    `;
  }

  createRenderRoot() {
    // TODO work out multiple render roots / slots
    return this;
    //return this.querySelector(".render-root");
  }

  connectedCallback() {
    super.connectedCallback();
    manager.register(this);

    // TODO: lazy load thumbnails?
    const thumbnail: HTMLImageElement | null = this.querySelector(".bookmark-thumbnail img");
    if (thumbnail) {
      thumbnail.addEventListener("load", () => {
      });

      thumbnail.addEventListener("error", () => {
        const { parentElement } = thumbnail;
        if (parentElement) {
          // Replace broken image with muted red link SVG default
          parentElement.innerHTML = linkSvg();
          parentElement.style.color = "rgba(255, 128, 128, 0.2)";
        }
      });
    }

    // this.isLoading = true;
    // manager.updateFeed(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    manager.unregister(this);
  }

  get url() {
    return this.querySelector(".u-url")?.getAttribute("href");
  }

  render() {
    /*
    render(
      this.actionsTemplate({ title: Date.now() }),
      this.querySelector(".moar-actions")
    );
    return html`
      <div>
        <span>
          ${this.isLoading ? "loading...." : ""}
          ${this.hasFeed ? "has feed!" : ""}
          ${this.feedUrl}
          ${this.feedFetched && `items ${this.feedFetched.items.total}`}
        </span>
      </div>
    `;
    */
  }
}

export class PCBookmarkElementManager {
  elements: Map<string, PCBookmarkElement>;
  lastId: number;
  discoverQueue: BatchQueue<DiscoverQueueJob>;
  fetchFeedQueue: BatchQueue<FetchFeedQueueJob>;

  constructor() {
    this.elements = new Map();
    this.lastId = 0;
    this.discoverQueue = new BatchQueue<DiscoverQueueJob>({
      batchSize: 10,
      onBatch: this.discoverBatch.bind(this),
    });

    this.fetchFeedQueue = new BatchQueue<FetchFeedQueueJob>({
      batchSize: 10,
      onBatch: this.fetchFeedBatch.bind(this),
    });
  }

  genId() {
    return `pc-bookmark-${++this.lastId}`;
  }

  register(element: PCBookmarkElement) {
    if (!element.id) element.id = this.genId();
    this.elements.set(element.id, element);
  }

  unregister(element: PCBookmarkElement) {
    const id = element.id;
    if (id) this.elements.delete(id);
  }

  async updateFeed(element: PCBookmarkElement) {
    this.discoverQueue.push({ element, url: element.url! });
  }

  async discoverBatch(batch: DiscoverQueueJob[]) {
    const urls = batch.map(({ url }) => url);

    const response = await fetch("/feeds/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });

    if (response.status !== 200) {
      throw Error(`feed discovery failed ${response.status}`);
    }

    const results: DiscoverBatchResult = await response.json();
    for (const result of results) {
      for (const { element, url } of batch) {
        if (url === result.url) {
          element.isLoading = false;
          if (result.success) {
            if (result.discovered.length > 0) {
              element.hasFeed = true;
              const feedUrl = result.discovered[0].href;
              element.feedUrl = feedUrl;
              element.isLoading = true;
              this.fetchFeedQueue.push({ element, url, feedUrl });
            }
          }
        }
      }
    }
  }

  /**
   *
   * @param {Array<{ element: PCBookmarkElement, url: string, feedUrl: string }>} batch
   */
  async fetchFeedBatch(batch: FetchFeedQueueJob[]): Promise<void> {
    const urls = batch.map(({ feedUrl }) => feedUrl);

    const response = await fetch("/feeds/get", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });

    if (response.status !== 200) {
      throw Error(`feed fetch failed ${response.status}`);
    }

    const results = await response.json();
    for (const result of results) {
      for (const { element, feedUrl } of batch) {
        if (feedUrl === result.url) {
          element.isLoading = false;
          if (result.success) {
            element.hasFeed = true;
            element.feedFetched = result.fetched;
          }
        }
      }
    }
  }
}

type DiscoverQueueJob = { element: PCBookmarkElement; url: string };

type FetchFeedQueueJob = {
  element: PCBookmarkElement;
  url: string;
  feedUrl: string;
};

type DiscoverBatchResult = Array<
  | { success: false; url: string; error: any }
  | {
      success: true;
      url: string;
      discovered: Array<{
        type: string;
        href: string;
        title?: string;
      }>;
    }
>;

export const manager = new PCBookmarkElementManager();

customElements.define("pc-bookmark", PCBookmarkElement);
