import { LitElement } from "lit";

import "./pc-description-iframe.css";

export default class PCDescriptionIframeElement extends LitElement {
  iframe?: HTMLIFrameElement | null;
  itemId?: string;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    
    // Get the iframe and item ID
    this.iframe = this.querySelector('iframe');
    this.itemId = this.getAttribute('item-id');
    
    if (this.iframe && this.itemId) {
      this.setupIframe();
    }
  }

  setupIframe() {
    if (!this.iframe || !this.itemId) return;

    // Get current page colors
    const body = document.body;
    const textColor = this.getComputedColorValue(body, 'color');
    const bgColor = this.getComputedColorValue(body, 'background-color');
    const linkColor = this.getComputedColorValue(document.documentElement, '--theme-link-color') || '#0066cc';
    
    // Convert RGB to hex if needed
    const textHex = textColor.startsWith('rgb') ? this.rgbToHex(textColor) : textColor;
    const bgHex = bgColor.startsWith('rgb') ? this.rgbToHex(bgColor) : 'transparent';
    const linkHex = linkColor.startsWith('rgb') ? this.rgbToHex(linkColor) : linkColor;
    
    // Update iframe src with color parameters
    const url = new URL(this.iframe.src);
    url.searchParams.set('text_color', textHex);
    url.searchParams.set('bg_color', bgHex);
    url.searchParams.set('link_color', linkHex);
    
    this.iframe.src = url.toString();
    
    // Set up resize handler for after reload
    this.iframe.onload = () => this.resizeIframe();
  }

  resizeIframe() {
    if (!this.iframe) return;

    try {
      const doc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
      if (doc) {
        // Reset to minimum height first to allow shrinking
        this.iframe.style.height = '50px';
        
        // Wait for content to be fully rendered
        setTimeout(() => {
          const body = doc.body;
          const html = doc.documentElement;
          const height = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          );
          
          // Set minimum and maximum heights
          const finalHeight = Math.min(Math.max(height + 10, 50), 500);
          this.iframe!.style.height = finalHeight + 'px';
        }, 50);
      }
    } catch (e) {
      // Cross-origin or other security errors - use default height
      this.iframe.style.height = '100px';
    }
  }

  private getComputedColorValue(element: Element, property: string): string {
    const computed = window.getComputedStyle(element);
    return computed.getPropertyValue(property);
  }

  private rgbToHex(rgb: string): string {
    const match = rgb.match(/\d+/g);
    if (!match) return rgb;
    
    const [r, g, b] = match.map(Number);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}

customElements.define("pc-description-iframe", PCDescriptionIframeElement);