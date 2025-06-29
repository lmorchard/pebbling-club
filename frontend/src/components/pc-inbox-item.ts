import { LitElement, html, render } from "lit";
import linkSvg from "../svg/link";

import "./pc-inbox-item.css";

export default class PCInboxItemElement extends LitElement {
  item?: object;
  disconnectAbortSignal?: AbortController;
  elActions?: HTMLElement | null;
  elCheckbox?: HTMLInputElement | null;

  static get properties() {
    return {
      item: {
        type: Object,
        attribute: true,
        converter: {
          fromAttribute: (value: string) => {
            if (value) {
              try {
                return null; // JSON.parse(atob(value));
              } catch (e) {
                console.warn("Failed to decode inbox item", e, value);
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
    this.elActions = this.querySelector(".actions");
    this.elCheckbox = this.querySelector(".item-checkbox");

    super.connectedCallback();
    this.enhanceThumbnail();
    this.setupCheckboxEvents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal!.abort();
  }

  setupCheckboxEvents() {
    if (this.elCheckbox) {
      this.elCheckbox.addEventListener(
        "change",
        () => {
          // Emit custom event for selection change
          this.dispatchEvent(
            new CustomEvent("inbox-item-selection-changed", {
              bubbles: true,
              detail: {
                itemId: this.elCheckbox!.value,
                selected: this.elCheckbox!.checked,
              },
            })
          );
        },
        { signal: this.disconnectAbortSignal!.signal }
      );
    }
  }

  enhanceThumbnail() {
    // TODO: lazy load thumbnails?
    const thumbnail: HTMLImageElement | null = this.querySelector(
      ".thumbnail img"
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

  render() {
    // Additional rendering logic can go here if needed
  }
}

customElements.define("pc-inbox-item", PCInboxItemElement);