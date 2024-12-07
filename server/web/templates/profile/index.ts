import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

import { BookmarkWithPermissions, TagCount } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";

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
  ...locals
}: Props) => {
  return layout({
    ...locals,
    title: profile.username,
    content: html`
      <section class="profile">
        <section class="bookmarks">
          <nav class="secondary">
            <h2>Bookmarks</h2>
            <details class="autoclose menu">
              <summary>List</summary>
              <div>
                
                <a href="/signup">Signup</a>
                <a href="/login">Login</a>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras auctor dolor in nunc lacinia, non aliquet eros condimentum. In lacinia lobortis posuere. Curabitur est quam, iaculis vitae accumsan at, fermentum quis neque. Pellentesque eu leo quam. Mauris pretium nibh non odio euismod, sit amet pellentesque magna vulputate. Pellentesque pulvinar, justo ut tincidunt tempus, nunc ante molestie massa, ac tincidunt leo diam vitae eros. Fusce ac feugiat libero. Sed in euismod sem. Donec placerat erat at neque pharetra, eu ullamcorper arcu congue. Donec sed aliquet mi. Curabitur facilisis luctus quam eget laoreet. 
              </div>
            </details>
          </nav>
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
          <nav class="secondary">
            <h2>Tags</h2>
            <details class="autoclose menu">
              <summary>List</summary>
              <div>
                
                <a href="/signup">Signup</a>
                <a href="/login">Login</a>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras auctor dolor in nunc lacinia, non aliquet eros condimentum. In lacinia lobortis posuere. Curabitur est quam, iaculis vitae accumsan at, fermentum quis neque. Pellentesque eu leo quam. Mauris pretium nibh non odio euismod, sit amet pellentesque magna vulputate. Pellentesque pulvinar, justo ut tincidunt tempus, nunc ante molestie massa, ac tincidunt leo diam vitae eros. Fusce ac feugiat libero. Sed in euismod sem. Donec placerat erat at neque pharetra, eu ullamcorper arcu congue. Donec sed aliquet mi. Curabitur facilisis luctus quam eget laoreet. 
              </div>
            </details>
          </nav>
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
