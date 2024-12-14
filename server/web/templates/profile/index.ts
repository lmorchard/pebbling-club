import { html, TemplateContent } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

import { BookmarkWithPermissions, TagCount } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";

import svgFeed from "@common/svg/feed";

import partialBookmarkList from "../partials/bookmarkList";
import partialPaginator from "../partials/paginator";
import {
  BookmarksListRouteOptions,
  defaultBookmarksListRouteOptions,
} from "../../utils/routes";
import { stripDefaults } from "@/utils/defaults";

export interface Props extends LayoutProps {
  profile: Profile;
  q?: string;
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
  q,
  show,
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
      ${bookmarkListSearchForm({ q, open, show })}

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
            q,
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

type BookmarkListSearchFormProps = Pick<
  BookmarksListRouteOptions,
  "open" | "show" | "q"
>;

function bookmarkListSearchForm(
  props: BookmarkListSearchFormProps
): TemplateContent {
  const { open, show, q } = stripDefaults(
    props,
    defaultBookmarksListRouteOptions
  );
  return html`
    <div class="search">
      <form method="get" action="">
      ${open && html`<input type="hidden" name="open" value="${open}" />`}
      ${
        show &&
        show.length > 0 &&
        html`<input type="hidden" name="show" value="${show.join(",")}" />`
      }
        <input name="q" type="search" placeholder="Search" value="${
          q ? q : ""
        }" />
      </form>
    </div>
  `;
}
