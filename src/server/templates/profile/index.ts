import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

import { Bookmark, TagCount } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";

import partialBookmarkList from "../partials/bookmarkList";
import partialPaginator from "../partials/paginator";

export interface Props extends LayoutProps {
  profile: Profile;
  bookmarks: Bookmark[];
  tagCounts: TagCount[];
  limit: number;
  offset: number;
  total: number;
}

export default ({
  profile,
  bookmarks,
  tagCounts,
  total,
  limit,
  offset,
  ...locals
}: Props) => {
  return layout({
    ...locals,
    content: html`
      <section class="profile">
        <section class="bookmarks">
          ${partialPaginator({ total, limit, offset })}
          ${partialBookmarkList({ bookmarks, profile })}
          ${partialPaginator({ total, limit, offset })}
        </section>
        <section class="tagCounts">
          <ul>
            ${tagCounts.map(({ name, count }) => html`
              <li><a href="/u/${profile.username}/t/${name}">${name} (${count})</a></li>
            `)}
          </ul>
        </section>
      </section>
    `,
  });
};
