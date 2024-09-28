import { BookmarkWithPermissions } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";
import { html } from "../../utils/html";
import partialBookmark from "./bookmark";

export interface Props {
  bookmarks: BookmarkWithPermissions[];
  profile: Profile;
}

export default ({ bookmarks, profile }: Props) => html`
  <ul class="bookmarks h-feed">
    ${bookmarks.map(
      (bookmark) =>
        html`<li>
          ${partialBookmark({ bookmark, profile, hideAuthor: true })}
        </li>`
    )}
  </ul>
`;
