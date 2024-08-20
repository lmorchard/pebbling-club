export class DetailsCloser extends HTMLElement {
  connectedCallback() {
    this.onClickHandler = (ev) => this.onClick(ev);
    this.addEventListener("click", this.onClickHandler);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.onClickHandler);
  }

  onClick(ev) {
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
