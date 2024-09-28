import { BookmarkWithPermissions } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";
import { html } from "../../utils/html";

export interface Props {
  bookmark: BookmarkWithPermissions;
  profile: Profile;
  readOnly?: boolean;
  hideAuthor?: boolean;
}

export default ({ bookmark, profile, readOnly = false, hideAuthor = false }: Props) => {
  const created = new Date(bookmark.created!);
  const modified = new Date(bookmark.modified!);
  return html`
    <pc-bookmark>
      <div class="bookmark h-entry">
        <div class="header">
          <a class="p-name u-url" href="${bookmark.href}">${bookmark.title}</a>
        </div>
        <div class="href"><a href="${bookmark.href}">${bookmark.href}</a></div>
        ${bookmark.extended &&
        html`<div class="p-summary">${bookmark.extended}</div>`}
        <div class="meta">
          ${!readOnly && bookmark.canEdit &&
          html`
            <div class="actions">
              <a href="/bookmarks/${bookmark.id}/edit">Edit</a>
              <a href="/bookmarks/${bookmark.id}/delete">Delete</a>
              <!-- <span class="moar-actions"></span> -->
            </div>
          `}
          <time
            class="dt-published"
            title="${created.toISOString()}"
            datetime="${created.toISOString()}"
          >
            <a href="/bookmarks/${bookmark.id}">${created.toISOString()}</a>
          </time>
          ${!hideAuthor && html`
            <a class="p-author" href="/u/${profile.username}">${profile.username}</a>
          `}
          ${bookmark.tags?.length &&
          html`
            <div class="tags">
              ${bookmark.tags?.map((tag) =>
                profile
                  ? html`
                      <a
                        href="/u/${profile.username}/t/${tag}"
                        rel="category tag"
                        class="p-category"
                        >${tag}</a
                      >
                    `
                  : html`
                      <a href="/t/${tag}" rel="category tag" class="p-category"
                        >${tag}</a
                      >
                    `
              )}
            </div>
          `}
        </div>
        <!-- <div class="render-root"></div> -->
      </div>
    </pc-bookmark>
  `;
};
