import { Bookmark } from "../../../services/bookmarks";
import { html } from "../../utils/html";

export interface Props {
  bookmark: Bookmark;
}

export default ({ bookmark }: Props) => {
  const created = new Date(bookmark.created!);
  const modified = new Date(bookmark.modified!);
  return html`
    <div class="bookmark h-entry">
      <a class="p-name u-url" href="${bookmark.href}">${bookmark.title}</a>
      <div class="href"><a href="${bookmark.href}">${bookmark.href}</a></div>
      ${bookmark.extended &&
      html`<div class="p-summary">${bookmark.extended}</div>`}
      <div class="p-category">${bookmark.tags}</div>
      <time
        class="dt-published"
        title="${created.toISOString()}"
        datetime="${created.toISOString()}"
      >
        ${created.toISOString()}
      </time>
    </div>
  `;
};
