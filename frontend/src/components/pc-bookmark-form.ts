import { LitElement, html, render } from "lit";
import delayFn from "../utils/delay";
import "./pc-bookmark-form.css";

export default class PCBookmarkFormElement extends LitElement {
    disconnectAbortSignal = new AbortController();

    refreshButton?: HTMLElement | null;
    urlField?: HTMLInputElement | null;
    titleField?: HTMLInputElement | null;
    descriptionField?: HTMLTextAreaElement | null;
    submitButton?: HTMLButtonElement | null;

    autoSubmitDelay = 500;
    isUnfurlLoading = false;

    refreshButtonOriginalContent?: string;

    refreshButtonTemplate = (props: this) => html`
        ${props.refreshButtonOriginalContent}
        ${props.isUnfurlLoading ? html`(loading)` : null}
    `;

    static get properties() {
        return {
            isUnfurlLoading: { type: Boolean },
            autoSubmitDelay: { type: Number },
        };
    }

    createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();

        const { signal } = this.disconnectAbortSignal;
        const commonEventOptions = { signal };
        const handleUnfurlRefresh = this.onUnfurlRefresh.bind(this);

        this.submitButton = this.querySelector("button[type=submit]");

        const params = new URLSearchParams(window.location.search);
        if (params.get("submit") === "auto") {
            setTimeout(() => {
                if (this.submitButton) this.submitButton.click();
            }, this.autoSubmitDelay);
        }

        this.refreshButton = this.querySelector(".unfurl-data .refresh");
        if (this.refreshButton) {
            this.refreshButtonOriginalContent =
                this.refreshButton.textContent || "Refresh";
            this.refreshButton.innerHTML = "";
            this.refreshButton.addEventListener(
                "click",
                (ev) => {
                    ev.preventDefault();
                    handleUnfurlRefresh();
                },
                commonEventOptions
            );
        }

        this.urlField = this.querySelector("input[name=url]");
        if (this.urlField) {
            this.urlField.addEventListener(
                "change",
                delayFn(handleUnfurlRefresh, 100),
                commonEventOptions
            );
        }

        this.titleField = this.querySelector("input[name=title]");
        this.descriptionField = this.querySelector(
            "textarea[name=description]"
        );
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
                this.querySelector("input[name=url]");
            if (urlField) {
                const { value } = urlField;
                const params = new URLSearchParams({ href: value });
                const resp = await fetch(
                    `/bookmarks/unfurl?${params.toString()}`
                );
                if (resp.status === 200) {
                    const unfurlDataField: HTMLTextAreaElement | null =
                        this.querySelector(
                            ".unfurl-data textarea[name=unfurl_metadata]"
                        );
                    if (unfurlDataField) {
                        const { title, description, ...data } =
                            await resp.json();
                        if (this.titleField && !this.titleField.value) {
                            this.titleField.value = title;
                        }
                        if (
                            this.descriptionField &&
                            !this.descriptionField.value
                        ) {
                            this.descriptionField.value = description;
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
