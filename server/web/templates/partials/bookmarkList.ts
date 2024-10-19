import { BookmarkWithPermissions } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";
import { html } from "../../utils/html";
import partialBookmark from "./bookmark";

export interface Props {
  bookmarks: BookmarkWithPermissions[];
  profile: Profile;
  hideAuthor?: boolean;
  show?: string[];
  open?: string;
}

export default ({
  bookmarks,
  profile,
  hideAuthor = true,
  show = ["notes", "feed", "embed", "unfurl"],
  open,
}: Props) => html`
  <pc-bookmark-list>
    <ul class="bookmarks h-feed">
      ${bookmarks.map(
        (bookmark) =>
          html`<li>
            ${partialBookmark({
              bookmark,
              profile,
              hideAuthor,
              show,
              open,
            })}
          </li>`
      )}
    </ul>
  </pc-bookmark-list>
`;
