import { LitElement, html, render } from "lit";
import linkSvg from "@common/svg/link";

import "./pc-bookmark.css";

export default class PCBookmarkElement extends LitElement {
  hiddenContentViews?: string[];
  defaultSelectedContentView?: string;
  selectedContentView?: string;
  bookmark?: Object;

  static get properties() {
    return {
      hiddenContentViews: { type: Array },
      defaultSelectedContentView: { type: String },
      selectedContentView: { type: String, attribute: true, reflect: true },
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

  disconnectAbortSignal = new AbortController();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();

    this.selectDefaultContentView();
    this.enhanceContentSelector();
    this.enhanceThumbnail();
  }

  disconnectedCallback() {
    super.disconnectedCallback();    
    this.disconnectAbortSignal.abort();
  }

  render() {
    if (this.contentSelector) {
      render(this.contentSelectorTemplate(this), this.contentSelector);
    }
  }

  get url() {
    return this.querySelector(".u-url")?.getAttribute("href");
  }

  contentSelector?: HTMLElement | null;

  contentSelectorTemplate = (props: this) => {
    const selectableViews = this.contentViews.filter(
      ([name, _contentEl]) =>
        name && !(this.hiddenContentViews || []).includes(name)
    );
    if (selectableViews.length === 1) return null;
    return html`
      ${selectableViews.map(
        ([name, contentEl]) => html`
          <label>
            <input type="radio" name="content" value="${name}"
              ?checked=${name === props.selectedContentView} />
            <span>${contentEl.dataset.title || name}</span>
          </label>      
        `
      )}
    `;
  };

  enhanceContentSelector() {
    const { signal } = this.disconnectAbortSignal;
    this.contentSelector = this.querySelector<HTMLElement>(".content-selector");
    if (this.contentSelector) {
      this.contentSelector.addEventListener(
        "change",
        (ev) => {
          const { target } = ev;
          if (target instanceof HTMLInputElement && target.name == "content") {
            const { value: selectedName } = target;
            this.selectContentView(selectedName, false);
          }
        },
        { signal }
      );
    }
  }

  get contentViewSelectors() {
    const els = this.querySelectorAll<HTMLInputElement>(
      ".content-selector input"
    );
    const hiddenContentViews = this.hiddenContentViews || [];
    if (els.length) {
      return Array.from(els)
        .map((el) => [el.value, el] as const)
        .filter(([name, el]) => !hiddenContentViews.includes(name));
    }
    return [];
  }

  get contentViews() {
    const els = this.querySelectorAll<HTMLElement>(".content-views .content");
    if (els.length) {
      return Array.from(els).map((el) => [el.dataset["name"], el] as const);
    }
    return [];
  }

  selectContentView(selectedName: string, updateChecked: boolean = true) {
    this.selectedContentView = selectedName;
    for (const [name, el] of this.contentViews) {
      el.classList[name === selectedName ? "add" : "remove"]("selected");
    }
  }

  selectDefaultContentView() {
    if (this.contentViews?.length) {
      const firstViewName = this.contentViews[0][0];
      const defaultSelected = /* this.defaultSelectedContentView || */ firstViewName;
      if (defaultSelected) {
        this.selectContentView(defaultSelected, true);
      }
    }
  }

  enhanceThumbnail() {
    // TODO: lazy load thumbnails?
    const thumbnail: HTMLImageElement | null = this.querySelector(
      ".bookmark-thumbnail img"
    );
    if (thumbnail) {
      thumbnail.addEventListener("load", () => {});

      thumbnail.addEventListener("error", () => {
        const { parentElement } = thumbnail;
        if (parentElement) {
          // Replace broken image with muted red link SVG default
          parentElement.innerHTML = linkSvg();
          parentElement.style.color = "rgba(255, 128, 128, 0.2)";
        }
      });
    }
  }
}

customElements.define("pc-bookmark", PCBookmarkElement);
