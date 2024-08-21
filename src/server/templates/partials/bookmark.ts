import { Bookmark } from "../../../services/bookmarks";
import { html } from "../../utils/html";

export interface Props {
  bookmark: Bookmark;
  readOnly?: boolean;
}

export default ({ bookmark, readOnly = false }: Props) => {
  const created = new Date(bookmark.created!);
  const modified = new Date(bookmark.modified!);
  return html`
    <div class="bookmark h-entry">
      <div class="header">
        <a class="p-name u-url" href="${bookmark.href}">${bookmark.title}</a>
      </div>
      <div class="href"><a href="${bookmark.href}">${bookmark.href}</a></div>
      ${bookmark.extended &&
      html`<div class="p-summary">${bookmark.extended}</div>`}
      <div class="meta">
        ${!readOnly && html`
          <div class="actions">
            <a href="/bookmarks/${bookmark.id}/edit">Edit</a>
            <a href="/bookmarks/${bookmark.id}/delete">Delete</a>
          </div>
        `}
        <time
          class="dt-published"
          title="${created.toISOString()}"
          datetime="${created.toISOString()}"
        >
          ${created.toISOString()}
        </time>
        ${bookmark.tags?.length &&
        html`
          <div class="tags">
            ${bookmark.tags?.map(
              (tag) => html`
                <a href="/tags/${tag}" rel="category tag" class="p-category"
                  >${tag}</a
                >
              `
            )}
          </div>
        `}
      </div>
    </div>
  `;
};
