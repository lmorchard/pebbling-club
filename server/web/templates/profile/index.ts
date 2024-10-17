import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

import { BookmarkWithPermissions, TagCount } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";

import partialBookmarkList from "../partials/bookmarkList";
import partialPaginator from "../partials/paginator";

export interface Props extends LayoutProps {
  profile: Profile;
  showAttachments?: string[];
  openAttachment?: string;
  bookmarks: BookmarkWithPermissions[];
  tagCounts: TagCount[];
  limit: number;
  offset: number;
  total: number;
}

export default ({
  profile,
  bookmarks,
  showAttachments = ["notes", "feed", "embed", "unfurl"],
  openAttachment,
  tagCounts,
  total,
  limit,
  offset,
  ...locals
}: Props) => {
  return layout({
    ...locals,
    title: profile.username,
    content: html`
      <section class="profile">
        <section class="bookmarks">
          ${partialPaginator({ total, limit, offset, showAttachments, openAttachment })}
          ${partialBookmarkList({
            bookmarks,
            profile,
            showAttachments,
            openAttachment,
          })}
          ${partialPaginator({ total, limit, offset, showAttachments, openAttachment })}
        </section>
        <section class="tagCounts">
          <ul>
            ${tagCounts.map(
              ({ name, count }) => html`
              <li><a href="/u/${profile.username}/t/${name}">${name} (${count})</a></li>
            `
            )}
          </ul>
        </section>
      </section>
    `,
  });
};
