import { LitElement, html, render } from "lit";
import BatchQueue from "../utils/batch-queue";

import "./pc-bookmark-list.css";

export default class PCBookmarkListElement extends LitElement {
  connectedCallback() {
    super.connectedCallback();

  }
}

customElements.define("pc-bookmark-list", PCBookmarkListElement);