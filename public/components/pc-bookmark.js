import { LitElement, html, render } from "../vendor/lit-core.min.js";
import BatchQueue from "../utils/batch-queue.js";

export default class PCBookmarkElement extends LitElement {
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

    // this.isLoading = true;
    // manager.updateFeed(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    manager.unregister(this);
  }

  get url() {
    return this.querySelector(".u-url").getAttribute("href");
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
  constructor() {
    /** @type {Map<string, PCBookmarkElement>} */
    this.elements = new Map();
    this.lastId = 0;
    this.discoverQueue = new BatchQueue({
      batchSize: 10,
      onBatch: (batch) => this.discoverBatch(batch),
    });
    this.fetchFeedQueue = new BatchQueue({
      batchSize: 10,
      onBatch: (batch) => this.fetchFeedBatch(batch),
    });
  }

  /** 
   * @returns string
   */
  genId() {
    return `pc-bookmark-${++this.lastId}`;
  }

  /**
   * Register a managed element
   * @param {PCBookmarkElement} element
   */
  register(element) {
    if (!element.id) element.id = this.genId();
    this.elements.set(element.id, element);
  }

  /**
   * Unregister a managed element
   * @param {PCBookmarkElement} element
   */
  unregister(element) {
    const id = element.id;
    if (id) this.elements.delete(id);
  }

  /**
   *
   * @param {PCBookmarkElement} element
   */
  async updateFeed(element) {
    this.discoverQueue.push({ element, url: element.url });
  }

  /**
   *
   * @param {Array<{ element: PCBookmarkElement, url: string }>} batch
   */
  async discoverBatch(batch) {
    const urls = batch.map(({ url }) => url);

    const response = await fetch("/feeds/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });

    if (response.status !== 200) {
      throw Error(`feed discovery failed ${response.status}`);
    }

    /** @type {DiscoverBatchResult} */
    const results = await response.json();
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
              this.fetchFeedQueue.push({ element, feedUrl });
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
  async fetchFeedBatch(batch) {
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

/**
 * @typedef {Array<
 *  | { success: false, url: string, error: any }
 *  | {
 *      success: true,
 *      url: string,
 *      discovered: Array<{
 *        type: string,
 *        href: string,
 *        title?: string
 *      }>
 *    }
 * >} DiscoverBatchResult
 */

export const manager = (window.PCBookmarkElementManager =
  new PCBookmarkElementManager());

customElements.define("pc-bookmark", PCBookmarkElement);
