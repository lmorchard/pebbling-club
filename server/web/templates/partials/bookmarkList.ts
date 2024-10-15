import { BookmarkWithPermissions } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";
import { html } from "../../utils/html";
import partialBookmark from "./bookmark";

export interface Props {
  bookmarks: BookmarkWithPermissions[];
  profile: Profile;
  hideAuthor?: boolean;
  showAttachments?: string[];
  openAttachment?: string;
}

export default ({
  bookmarks,
  profile,
  hideAuthor = true,
  showAttachments = ["notes", "feed", "embed", "unfurl"],
  openAttachment,
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
              showAttachments,
              openAttachment,
            })}
          </li>`
      )}
    </ul>
  </pc-bookmark-list>
`;
