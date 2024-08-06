import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";
import { field, FormData, FormErrors, FormValidationError } from "../../utils/forms";
import partialBookmark from "../partials/bookmark";
import { Bookmark } from "../../../services/bookmarks";

export interface Props extends LayoutProps {
  bookmark: Bookmark;
}

export default ({ bookmark, ...locals }: Props) => {
  return layout({
    ...locals,
    content: html`
      <section>
        ${partialBookmark({ bookmark })}
      </section>
    `,
  });
};
