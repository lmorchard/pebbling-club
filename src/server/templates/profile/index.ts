import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

import { Bookmark } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";

import partialBookmarkList from "../partials/bookmarkList";
import partialPaginator from "../partials/paginator";

export interface Props extends LayoutProps {
  profile: Profile;
  bookmarks: Bookmark[];
  limit: number;
  offset: number;
  total: number;
}

export default ({
  profile,
  bookmarks,
  total,
  limit,
  offset,
  ...locals
}: Props) => {
  return layout({
    ...locals,
    content: html`
      <h1>Profile ${profile.username}</h1>

      <section class="bookmarks">
        <h2>Bookmarks (${total})</h2>

        ${partialPaginator({ total, limit, offset })}
        ${partialBookmarkList({ bookmarks })}
        ${partialPaginator({ total, limit, offset })}

      </section>
    `,
  });
};
