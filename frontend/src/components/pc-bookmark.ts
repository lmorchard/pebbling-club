import { LitElement, html, render } from "lit";
import linkSvg from "../svg/link";

import "./pc-bookmark.css";

export default class PCBookmarkElement extends LitElement {
  bookmark?: Object;
  disconnectAbortSignal?: AbortController;
  elActions?: HTMLElement | null;
  elAttachments?: HTMLElement | null;

  static get properties() {
    return {
      bookmark: {
        type: Object,
        attribute: true,
        converter: {
          fromAttribute: (value: string) => {
            if (value) {
              try {
                return JSON.parse(atob(value));
              } catch (e) {
                console.warn("Failed to decode bookmark", e, value);
              }
            }
          },
        },
      },
    };
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    this.disconnectAbortSignal = new AbortController();
    this.elAttachments = this.querySelector("pc-bookmark-attachment-set");
    this.elActions = this.querySelector(".actions");

    super.connectedCallback();
    this.enhanceThumbnail();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal!.abort();
  }

  extendedActionsTemplate = () => html`
    ${this.elAttachments &&
    html`<a @click=${this.toggleAttachments.bind(this)}>${this.elAttachments.classList.contains("hide")
        ? html`&#x25BC;`
        : html`&#x25B2;`
      }</a>`
    }
  `;

  toggleAttachments() {
    if (!this.elAttachments) return;
    this.elAttachments.classList.toggle("hide");
    this.requestUpdate();
  }

  render() {
    if (this.elActions) render(this.extendedActionsTemplate(), this.elActions);
  }

  get url() {
    return this.querySelector(".u-url")?.getAttribute("href");
  }

  enhanceThumbnail() {
    // TODO: lazy load thumbnails?
    const thumbnail: HTMLImageElement | null = this.querySelector(
      ".bookmark-thumbnail img"
    );
    if (thumbnail) {
      thumbnail.addEventListener(
        "error",
        () => {
          const { parentElement } = thumbnail;
          if (parentElement) {
            // Replace broken image with muted red link SVG default
            parentElement.innerHTML = linkSvg();
            parentElement.style.color = "rgba(255, 128, 128, 0.2)";
          }
        },
        { signal: this.disconnectAbortSignal!.signal }
      );
    }
  }
}

customElements.define("pc-bookmark", PCBookmarkElement);
