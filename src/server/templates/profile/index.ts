import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

import { Bookmark } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";

import partialBookmark from "../partials/bookmark";
import partialBookmarkList from "../partials/bookmarkList";

export interface Props extends LayoutProps {
  profile: Profile;
  bookmarks: Bookmark[];
  pages: { offset: number }[];
  limit: number;
  total: number;
}

export default ({
  profile,
  bookmarks,
  total,
  limit,
  pages,
  ...locals
}: Props) => {
  return layout({
    ...locals,
    content: html`
      <h1>Profile ${profile.username}</h1>

      <section class="bookmarks">
        <h2>Bookmarks (${total})</h2>

        <div>
          ${pages.map(
            (page, idx) => html`
              | <a href="?limit=${limit}&offset=${page.offset}">${idx + 1}</a> |
            `
          )}
        </div>

        ${partialBookmarkList({ bookmarks })}
      </section>
    `,
  });
};
