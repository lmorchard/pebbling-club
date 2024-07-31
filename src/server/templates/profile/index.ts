import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

import { Bookmark } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";

import partialBookmark from "../partials/bookmark";

export interface Props extends LayoutProps {
  profile: Profile;
  bookmarks: Bookmark[];
}

export default ({ profile, bookmarks, ...locals }: Props) => {
  return layout({
    ...locals,
    content: html`
      <h1>Profile ${profile.username}</h1>

      <section class="bookmarks">
        <h2>Bookmarks</h2>
        ${bookmarks.map((bookmark) => partialBookmark({ bookmark }))}
      </section>
    `,
  });
};
