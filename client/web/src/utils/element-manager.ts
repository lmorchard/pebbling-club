export default class ElementManager<E extends HTMLElement> {
  elements = new Map<string, E>();
  idPrefix = "element";
  lastId = 0;

  genId() {
    return `${this.idPrefix}-${++this.lastId}`;
  }

  register(element: E) {
    if (!element.id) element.id = this.genId();
    this.elements.set(element.id, element);
  }

  unregister(element: E) {
    const id = element.id;
    if (id) this.elements.delete(id);
  }
}