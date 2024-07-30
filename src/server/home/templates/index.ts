import { html } from "../../../utils/html";
import { layout, LayoutProps } from "../../common/templates/layout";

export const home = ({ ...layoutProps }: {} & LayoutProps) =>
  layout({
    ...layoutProps,
    content: html` <h1>HELLO WORLD</h1> `,
  });
