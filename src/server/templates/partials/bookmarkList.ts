import { Bookmark } from "../../../services/bookmarks";
import { html } from "../../utils/html";
import partialBookmark from "../partials/bookmark";

export interface Props {
  bookmarks: Bookmark[];
}

export default ({ bookmarks }: Props) => html`
  <ul class="bookmarks h-feed">
    ${bookmarks.map(
      (bookmark) => html`<li>${partialBookmark({ bookmark })}</li>`
    )}
  </ul>
`;
