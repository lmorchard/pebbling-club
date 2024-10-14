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
  let host;
  try {
    const url = new URL(bookmark.href);
    host = url.host;
  } catch (e) {
    host = bookmark.href;
  }

  const bookmarkEncoded = Buffer.from(JSON.stringify(bookmark)).toString(
    "base64"
  );

  const created = new Date(bookmark.created!);
  const unfurl = bookmark.meta?.unfurl;
  const iframeUrl =
    unfurl?.iframe &&
    `data:text/html;base64,${Buffer.from(unfurl?.iframe).toString("base64")}`;
  const feedUrl = bookmark.meta?.unfurl?.feed;
  const thumbnailImage = unfurl?.image
    ? html`<img src="${unfurl.image}" />`
    : linkSvg;

  return html`
    <pc-bookmark
      bookmark="${bookmarkEncoded}"
      hiddenContentViews="${JSON.stringify(["unfurl"])}"
      defaultSelectedContentView="extended"
    >
      <div class="bookmark h-entry">    
        <a class="thumbnail" href="${bookmark.href}">${thumbnailImage}</a>

        ${
          !readOnly &&
          bookmark.canEdit &&
          html`
          <div class="actions">
            <a href="/bookmarks/${bookmark.id}/edit">Edit</a>
            <a href="/bookmarks/${bookmark.id}/delete">Delete</a>
          </div>
        `
        }

        <a class="p-name u-url" href="${bookmark.href}">${bookmark.title}</a>

        <div class="meta">
          <div class="href">
            <a href="${bookmark.href}">${host}</a>
          </div>

          ${
            !hideAuthor &&
            html`
            <a class="p-author" href="/u/${profile.username}">
              ${profile.username}
            </a>
          `
          }

          <time
            class="dt-published"
            title="${created.toISOString()}"
            datetime="${created.toISOString()}"
          >
            <a href="/bookmarks/${bookmark.id}">${created.toISOString()}</a>
          </time>

          ${
            bookmark.tags?.length &&
            html`
            <div class="tags">
              ${bookmark.tags?.map((tag) => {
                const tagUrl = profile
                  ? `/u/${profile.username}/t/${tag}`
                  : `/t/${tag}`;
                return html`
                  <a href="${tagUrl}" rel="category tag" class="p-category">
                    ${tag}
                  </a>
                `;
              })}
            </div>
          `
          }
        </div>

        <form class="content-selector">
          <!-- populated by component -->
        </form>

        <section class="content-views">
          ${
            bookmark.extended &&
            html`
              <section class="content" data-name="extended" data-title="Notes">
                <section class="p-summary">${bookmark.extended}</section>
              </section>
            `
          }
          ${
            feedUrl &&
            html`
              <section class="content" data-name="feed" data-title="Feed">
                <pc-feed url="${feedUrl}" />
              </section>
            `
          }
          ${
            iframeUrl &&
            html`
              <section class="content" data-name="iframe" data-title="Embed">
                <iframe
                  style="width: 100%"
                  width="400"
                  height="400"
                  src="${iframeUrl}"
                ></iframe>
              </section>
            `
          }
          ${
            bookmark.meta?.unfurl &&
            html`
              <section class="content" data-name="unfurl" data-title="Unfurl">
                <textarea rows="15" style="width: 90%">${bookmark.meta?.unfurl}</textarea>
              </section>
            `
          }
        </section>
      </div>
    </pc-bookmark>
  `;
};
