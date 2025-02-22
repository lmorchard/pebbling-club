import { LitElement, html, render } from "lit";

import "./pc-tab-group.css";

export class PCTabGroupElement extends LitElement {
  disconnectAbortSignal?: AbortController;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.disconnectAbortSignal = new AbortController();
    // HACK: this component's probably getting subclassed, so here's a
    // cheap way to inherit styles
    this.classList.add("pc-tab-group");
    // TODO: can drop this if/when <details name=""> is supported everywhere
    this.applyMutuallyExclusiveDetailsOpen();
  }

  applyMutuallyExclusiveDetailsOpen() {
    // TODO: move this to a reusable component or utility function?
    const { signal } = this.disconnectAbortSignal!;
    this.addEventListener(
      "click",
      (ev) => {
        const { target } = ev;
        // HACK: wish there were an HTMLSummaryElement for type-checking
        if (target instanceof HTMLElement && /summary/i.test(target.tagName)) {
          const details = target.closest("details");
          if (details) {
            const allDetails = this.querySelectorAll("details");
            for (const otherDetails of allDetails) {
              if (otherDetails !== details && otherDetails.open) {
                otherDetails.open = false;
              }
            }
          }
        }
      },
      { signal }
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal!.abort();
  }
}

customElements.define("pc-tab-group", PCTabGroupElement);

export class PCTabElement extends LitElement {
  disconnectAbortSignal?: AbortController;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.disconnectAbortSignal = new AbortController();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.disconnectAbortSignal!.abort();
  }
}

customElements.define("pc-tab", PCTabElement);
