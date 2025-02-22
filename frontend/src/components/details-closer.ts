export class DetailsCloser extends HTMLElement {
  onClickHandler?: (ev: any) => void;

  connectedCallback() {
    this.onClickHandler = (ev) => this.onClick(ev);
    this.addEventListener("click", this.onClickHandler);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.onClickHandler!);
  }

  onClick(ev: MouseEvent) {
    if (!(ev.target && ev.target instanceof Element)) return;
    
    const openDetails = this.querySelectorAll("details[open]");
    const withinDetails = ev.target.closest("details");
    for (const detailsEl of openDetails) {
      if (
        detailsEl !== withinDetails &&
        detailsEl.classList.contains("autoclose")
      ) {
        detailsEl.removeAttribute("open");
      }
    }
  }
}

customElements.define("details-closer", DetailsCloser);
