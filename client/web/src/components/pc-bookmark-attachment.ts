import { LitElement, html, render } from "lit";
import { PCTabElement, PCTabGroupElement } from "./pc-tab-group";

import "./pc-bookmark-attachment.css";

export class PCBookmarkAttachment extends PCTabElement {
  disconnectAbortSignal = new AbortController();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal.abort();
  }
}

customElements.define("pc-bookmark-attachment", PCBookmarkAttachment);

export class PCBookmarkAttachmentSet extends PCTabGroupElement {
  disconnectAbortSignal = new AbortController();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal.abort();
  }
}

customElements.define("pc-bookmark-attachment-set", PCBookmarkAttachmentSet);
