import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";
import partialBookmark from "../partials/bookmark";
import { BookmarkWithPermissions } from "../../../services/bookmarks";

export interface Props extends LayoutProps {
  bookmark: BookmarkWithPermissions;
}

export default ({ bookmark, csrfToken, ...locals }: Props) => {
  return layout({
    ...locals,
    content: html`
      <section>
        ${partialBookmark({ bookmark, readOnly: true })}
        <form action="" method="POST">
          <input type="hidden" name="_csrf" value="${csrfToken}" />
          <input type="submit" value="Delete bookmark" />
        </form>
      </section>
    `,
  });
};
