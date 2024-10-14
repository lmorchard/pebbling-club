import { LitElement, html, render } from "lit";
import ElementManager from "../utils/element-manager";
import BatchQueue from "../utils/batch-queue";

import "./pc-feed.css";

export default class PCFeedElement extends LitElement {
  disconnectAbortSignal = new AbortController();

  url?: string;
  isLoading?: boolean;
  feed?: any;

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
    manager.updateFeed(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal.abort();
    manager.unregister(this);
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
        ${sortedItems.slice(0, 15).map(
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
  idPrefix = "pc-feed";

  fetchFeedQueue = new BatchQueue<FetchFeedQueueJob>({
    batchSize: 10, // TODO: configure this somewhere
    onBatch: this.fetchFeedBatch.bind(this),
  });

  async updateFeed(element: PCFeedElement) {
    element.isLoading = true;
    this.fetchFeedQueue.push({ element, url: element.url! });
  }

  async fetchFeedBatch(batch: FetchFeedQueueJob[]): Promise<void> {
    const urls = batch.map(({ url }) => url);

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
      for (const { element, url } of batch) {
        if (url === result.url) {
          element.isLoading = false;
          if (result.success) {
            element.feed = result.fetched;
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

export const manager = new PCFeedElementManager();

customElements.define("pc-feed", PCFeedElement);
