import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

export interface Props extends LayoutProps {}

export default ({ bookmark, profile, ...locals }: Props) => {
  return layout({
    ...locals,
    content: html`
      <script>
        window.close();
      </script>
    `,
  });
};
