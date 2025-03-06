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
      !this.isLoading &&
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

    const items = this.feed?.items;
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
        ${sortedItems.slice(0, 100).map(
          (item: any) => html`
            <li class="item">
              <time dt="${item.date.toISOString()}"
                >${item.date.toLocaleString()}</time
              >
              <a target="_blank" href="${item.link}">
                ${item.title || "(untitled)"}
              </a>
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

  // TODO: work out how to specify since on a per-feed basis
  since?: string | null;

  idPrefix = "pc-feed";

  fetchFeedQueue = new BatchQueue<FetchFeedQueueJob>({
    batchSize: 10, // TODO: configure this somewhere
    onBatch: this.fetchFeedBatch.bind(this),
  });

  constructor({
    usePost = false,
    forceRefresh = false,
    since,
  }: {
    usePost?: boolean;
    forceRefresh?: boolean;
    since?: string | null;
  }) {
    super();
    this.usePost = usePost;
    this.forceRefresh = forceRefresh;
    this.since = since;
  }

  async updateFeed(element: PCFeedElement) {
    if (element.isLoading) return;
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
          update: forceRefresh,
          since: this.since,
          urls: batch.map((job) => job.url),
        }),
      });
    } else {
      const params = new URLSearchParams();
      if (this.since) params.set("since", this.since);
      for (const { url } of batch) {
        params.append("urls", url);
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
    for (const { element, url } of batch) {
      const result = results[url];
      element.isLoading = false;
      if (result?.success) {
        element.feed = result.fetched;
      } else if (result?.err) {
        element.error = result.err;
      }
    }
  }
}

interface FetchFeedQueueJob {
  element: PCFeedElement;
  url: string;
  since?: string;
}

// HACK: accessing this header data should probably be in a central context
const userJson = document.head.querySelector("script#user");
const forceRefreshJson = document.head.querySelector("script#forceRefresh");

// TODO: should accept ?since as an attribute or parameter in pc-feed or parent element?
const queryParams = new URLSearchParams(location.search);

export const manager = new PCFeedElementManager({
  // Use POST feed fetch only for logged in user
  usePost: !!userJson && !!forceRefreshJson,
  forceRefresh: !!forceRefreshJson,
  since: queryParams.get("since"),
});

customElements.define("pc-feed", PCFeedElement);
