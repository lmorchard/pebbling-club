import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

import { BookmarkWithPermissions, TagCount } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";

import svgFeed from "@common/svg/feed";

import partialBookmarkList from "../partials/bookmarkList";
import partialPaginator from "../partials/paginator";

export interface Props extends LayoutProps {
  profile: Profile;
  show?: string[];
  open?: string;
  bookmarks: BookmarkWithPermissions[];
  tagCounts: TagCount[];
  limit: number;
  offset: number;
  total: number;
  feedTitle: string;
  feedUrl: string;
}

export default ({
  profile,
  bookmarks,
  show = ["notes", "embed", "feed"],
  open,
  tagCounts,
  total,
  limit,
  offset,
  feedUrl,
  feedTitle,
  ...locals
}: Props) => {
  return layout({
    ...locals,
    title: profile.username,
    htmlHead: html`
      <link rel="alternate" type="application/rss+xml" title="${feedTitle}" href="${feedUrl}" />
    `,
    beforeSiteNav: html`
      <a href="${feedUrl}" class="feed icon" title="${feedTitle}">
        ${svgFeed}
      </a>
    `,
    content: html`
      <section class="profile">
        <section class="bookmarks">
          ${partialBookmarkList({
            bookmarks,
            profile,
            show,
            open,
          })}
          ${partialPaginator({
            total,
            limit,
            offset,
            show,
            open,
            stickyBottom: true,
          })}
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
