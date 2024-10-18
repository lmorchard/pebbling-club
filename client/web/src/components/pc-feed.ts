import { LitElement, html, render } from "lit";
import ElementManager from "../utils/element-manager";
import BatchQueue from "../utils/batch-queue";

import "./pc-feed.css";

export default class PCFeedElement extends LitElement {
  url?: string;
  isLoading?: boolean;
  feed?: any;
  error?: any;
  disconnectAbortSignal?: AbortController;

  static get properties() {
    return {
      url: { type: String, attribute: true },
      isLoading: { type: Boolean },
      feed: { type: Object },
    };
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();

    manager.register(this);
    this.disconnectAbortSignal = new AbortController();
    const { signal } = this.disconnectAbortSignal;

    // React to bookmark attachment tab group visibility changes
    this.closest("details")?.addEventListener(
      "toggle",
      (ev) => this.requestUpdate(),
      { signal }
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal!.abort();
    manager.unregister(this);
  }

  updated() {
    if (
      typeof this.feed === "undefined" &&
      typeof this.error === "undefined" &&
      this.checkVisibility()
    ) {
      // Update feed if we're visible and haven't yet
      manager.updateFeed(this);
    }
  }

  render() {
    if (
      typeof this.isLoading === "undefined" &&
      typeof this.feed === "undefined"
    ) {
      return html``;
    }

    if (this.isLoading) {
      return html`(loading)`;
    }

    if (this.error) {
      return html`${JSON.stringify(this.error)}`;
    }

    const items = this.feed?.items?.items;
    if (!items?.length) {
      return html`(no items)`;
    }

    const sortedItems = items
      .map((item: any) => ({
        ...item,
        date: new Date(item.date || item.firstSeenAt),
      }))
      .sort(
        (a: { date: Date }, b: { date: Date }) =>
          b.date.getTime() - a.date.getTime()
      );

    return html`
      <ul class="items">
        ${sortedItems.slice(0, 25).map(
          (item: any) => html`
            <li class="item">
              <time dt="${item.date.toISOString()}">${item.date.toLocaleString()}</time>
              <a href="${item.link}">${item.title || "(untitled)"}</a>
            </li>
          `
        )}        
      </ul>
    `;
  }
}

export class PCFeedElementManager extends ElementManager<PCFeedElement> {
  usePost: boolean;
  forceRefresh: boolean;

  idPrefix = "pc-feed";

  fetchFeedQueue = new BatchQueue<FetchFeedQueueJob>({
    batchSize: 10, // TODO: configure this somewhere
    onBatch: this.fetchFeedBatch.bind(this),
  });

  constructor({
    usePost = false,
    forceRefresh = false,
  }: {
    usePost?: boolean;
    forceRefresh?: boolean;
  }) {
    super();
    this.usePost = usePost;
    this.forceRefresh = forceRefresh;
  }

  async updateFeed(element: PCFeedElement) {
    element.isLoading = true;
    this.fetchFeedQueue.push({ element, url: element.url! });
  }

  async fetchFeedBatch(batch: FetchFeedQueueJob[]): Promise<void> {
    const { forceRefresh } = this;
    let response: Response;

    if (this.usePost) {
      response = await fetch(`/feeds/get`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          forceFetch: forceRefresh,
          urls: batch.map((job) => job.url),
        }),
      });
    } else {
      const params = new URLSearchParams();
      for (const { url } of batch) {
        params.append("url", url);
      }
      response = await fetch(`/feeds/get?${params.toString()}`, {
        method: "GET",
        headers: { "content-type": "application/json" },
      });
    }

    if (response.status !== 200) {
      throw Error(`feed fetch failed ${response.status}`);
    }

    const results = await response.json();
    for (const result of results) {
      for (const { element, url } of batch) {
        if (url === result.url) {
          element.isLoading = false;
          if (result.success) {
            element.feed = result.fetched;
          } else {
            element.error = result.err;
          }
        }
      }
    }
  }
}

interface FetchFeedQueueJob {
  element: PCFeedElement;
  url: string;
}

// HACK: accessing this header data should probably be in a central context
const userJson = document.head.querySelector("script#user");
const forceRefreshJson = document.head.querySelector("script#forceRefresh");
export const manager = new PCFeedElementManager({
  // Use POST feed fetch only for logged in user
  usePost: !!userJson,
  forceRefresh: !!forceRefreshJson,
});

customElements.define("pc-feed", PCFeedElement);
