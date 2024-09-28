import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";
import partialBookmark from "../partials/bookmark";
import { Bookmark, BookmarkWithPermissions } from "../../../services/bookmarks";

export interface Props extends LayoutProps {
  bookmark: BookmarkWithPermissions;
}

export default ({ bookmark, profile, ...locals }: Props) => {
  return layout({
    ...locals,
    content: html`
      <section>
        ${partialBookmark({ bookmark, profile })}
      </section>
    `,
  });
};
