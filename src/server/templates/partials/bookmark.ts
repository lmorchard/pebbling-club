import { Bookmark } from "../../../services/bookmarks";
import { html } from "../../utils/html";

export interface Props {
  bookmark: Bookmark;
}

export default({ bookmark }: Props) => {
  return html`
    <div class="bookmark">
      <a href="${bookmark.href}" class="bookmark-title">${bookmark.title}</a>
      <p class="bookmark-extended">${bookmark.extended}</p>
      <p class="bookmark-tags">${bookmark.tags}</p>
    </div>
  `;
}