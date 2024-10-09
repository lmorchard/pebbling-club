import { BookmarkWithPermissions } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";
import { html } from "../../utils/html";
import linkSvg from "@common/svg/link";

export interface Props {
  bookmark: BookmarkWithPermissions;
  profile: Profile;
  readOnly?: boolean;
  hideAuthor?: boolean;
}

export default ({
  bookmark,
  profile,
  readOnly = false,
  hideAuthor = false,
}: Props) => {
  const created = new Date(bookmark.created!);
  const modified = new Date(bookmark.modified!);
  const unfurl = bookmark.meta?.unfurl;
  const iframeUrl = false;
  //  unfurl?.iframe &&
  //  `data:text/html;base64,${Buffer.from(unfurl?.iframe).toString("base64")}`;

  return html`
    <pc-bookmark>
      <div class="bookmark h-entry">
        <div class="bookmark-thumbnail">
          ${unfurl?.image ? html` <img src="${unfurl.image}" /> ` : linkSvg}
        </div>
        
        <div class="header">
          <a class="p-name u-url" href="${bookmark.href}">${bookmark.title}</a>
        </div>

        <div class="href">
          <a href="${bookmark.href}">${bookmark.href}</a>
        </div>

        ${bookmark.extended &&
        html`<div class="p-summary">${bookmark.extended}</div>`}
        ${iframeUrl &&
        html`
          <iframe
            style="width: 100%"
            width="400"
            height="400"
            src="${iframeUrl}"
          ></iframe>
        `}

        <div class="meta">
          ${!readOnly &&
          bookmark.canEdit &&
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
          ${!hideAuthor &&
          html`
            <a class="p-author" href="/u/${profile.username}"
              >${profile.username}</a
            >
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
      </div>
    </pc-bookmark>
  `;
};
