import { LitElement, html, render } from "lit";
import delayFn from "../utils/delay";
import "./pc-bookmark-form.css";

export default class PCBookmarkFormElement extends LitElement {
  disconnectAbortSignal = new AbortController();
  refreshButton?: HTMLElement | null;
  urlField?: HTMLInputElement | null;
  titleField?: HTMLInputElement | null;
  descriptionField?: HTMLTextAreaElement | null;

  isUnfurlLoading = false;

  refreshButtonTemplate = (props: this) =>
    html`Refresh ${props.isUnfurlLoading ? html`(loading)` : null}`;

  static get properties() {
    return {
      isUnfurlLoading: { type: Boolean },
    };
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    const { signal } = this.disconnectAbortSignal;

    const handleUnfurlRefresh = this.onUnfurlRefresh.bind(this);

    this.refreshButton = this.querySelector(".unfurl-data button.refresh");
    if (this.refreshButton) {
      this.refreshButton.innerHTML = "";
      this.refreshButton.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          handleUnfurlRefresh();
        },
        {
          signal,
        }
      );
    }

    this.urlField = this.querySelector("input[name=href]");
    if (this.urlField) {
      this.urlField.addEventListener(
        "change",
        delayFn(handleUnfurlRefresh, 100),
        { signal }
      );
    }

    this.titleField = this.querySelector("input[name=title]");
    this.descriptionField = this.querySelector("textarea[name=extended]");
  }

  disconnectCallback() {
    this.disconnectAbortSignal.abort();
  }

  render() {
    if (this.refreshButton) {
      render(this.refreshButtonTemplate(this), this.refreshButton);
    }
  }

  async onUnfurlRefresh() {
    this.isUnfurlLoading = true;

    try {
      const urlField: HTMLInputElement | null =
        this.querySelector("input[name=href]");
      if (urlField) {
        const { value } = urlField;
        const params = new URLSearchParams({ href: value });
        const resp = await fetch(`/bookmarks/unfurl?${params.toString()}`);
        if (resp.status === 200) {
          const unfurlDataField: HTMLTextAreaElement | null =
            this.querySelector(".unfurl-data textarea");
          if (unfurlDataField) {
            const data = await resp.json();
            if (this.titleField) {
              this.titleField.value = data.title;
            }
            if (this.descriptionField) {
              this.descriptionField.value = data.description;
            }
            unfurlDataField.value = JSON.stringify(data, null, 2);
          }
        }
      }
    } catch (err: any) {
      console.error("unfurl refresh failed", err);
    }

    this.isUnfurlLoading = false;
  }
}

customElements.define("pc-bookmark-form", PCBookmarkFormElement);
