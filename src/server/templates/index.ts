import { html } from "../utils/html";
import { layout, LayoutProps } from "./layout";

export interface Props extends LayoutProps {}

export default ({ ...locals }: Props) =>
  layout({
    ...locals,
    content: html` <h1>HELLO WORLD</h1> `,
  });
