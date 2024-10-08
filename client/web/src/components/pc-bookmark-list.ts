import { LitElement, html, render } from "lit";

import "./pc-bookmark-list.css";

export default class PCBookmarkListElement extends LitElement {
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
  }
}

customElements.define("pc-bookmark-list", PCBookmarkListElement);