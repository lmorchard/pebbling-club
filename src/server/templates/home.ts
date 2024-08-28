import { html } from "../utils/html";
import { layout, LayoutProps } from "./layout";
import Page from "./page";

export interface Props extends LayoutProps {}

export default ({ ...locals }: Props) =>
  Page({
    content: html`
      <section class="home">
        <nav>
          <a href="/login">Login</a>
        </nav>
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 30 20">
          <text class="tagline" lengthAdjust="spacing" fill="currentColor" x="0" y="15" textLength="30">🐧🪨</text>
        </svg>
      </section>
    `,
  });
