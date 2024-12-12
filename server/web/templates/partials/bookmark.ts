import classNames from "classnames";
import { BookmarkWithPermissions } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";
import { html, TemplateContent } from "../../utils/html";
import svgLink from "@common/svg/link";

export interface Props {
  bookmark: BookmarkWithPermissions;
  profile: Profile;
  readOnly?: boolean;
  hideAuthor?: boolean;
  show?: string[];
  open?: string;
}

export default (props: Props) => {
  const { bookmark, profile, readOnly = false, hideAuthor = false } = props;

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

  const thumbnailImage = unfurl?.image
    ? html`<img src="${unfurl.image}" />`
    : svgLink;

  return html`
    <pc-bookmark bookmark="${bookmarkEncoded}">
      <section class="bookmark h-entry">

        <a class="thumbnail" href="${bookmark.href}">${thumbnailImage}</a>

        <div class="actions">
          ${
            !readOnly &&
            bookmark.canEdit &&
            html`
              <a href="/bookmarks/${bookmark.id}/edit">Edit</a>
              <a href="/bookmarks/${bookmark.id}/delete">Delete</a>
          `
          }
        </div>

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

        ${buildAttachments(props)}

      </section>

    </pc-bookmark>
  `;
};

function buildAttachments({
  bookmark,
  open: openAttachmentIn,
  show: showAttachments = [],
}: Props) {
  // Filter out any attachments that don't have a formatter
  const validShowAttachments = showAttachments.filter(
    (name) => attachmentFormatters[name]
  );
  if (validShowAttachments.length === 0) return;

  // Determine which attachment to open - default to the first shown
  const openAttachment =
    openAttachmentIn && validShowAttachments.includes(openAttachmentIn)
      ? openAttachmentIn
      : validShowAttachments[0];

  // Hide attachments by default, unless one proves to be open
  let hideAttachments = true;

  const attachments = [];
  for (const name of validShowAttachments) {
    // Attempt to find a formatter for the named attachment
    const formatter = attachmentFormatters[name];
    if (!formatter) continue;

    // Attempt to format the attachment, skipping if no content
    const props = formatter(bookmark);
    if (!props) continue;

    // If the attachment has output and is the open attachment, show attachments
    if (name === openAttachment) hideAttachments = false;

    // Finally, render the attachment and add it to the list
    attachments.push(
      baseAttachmentTemplate({
        open: name === openAttachment,
        ...props,
      })
    );
  }

  // If no attachments, return early
  if (attachments.length === 0) return;

  // Hide attachment tabs if there is only one attachment
  const hideAttachmentTabs = attachments.length <= 1;

  return html`
    <pc-bookmark-attachment-set class="${classNames("vertical", {
      "hide-tabs": hideAttachmentTabs,
      hide: hideAttachments,
    })}">
      ${attachments}
    </pc-bookmark-attachment-set>
  `;
}

type AttachmentProps = {
  name: string;
  title: string;
  open: boolean;
  content: TemplateContent;
};

const baseAttachmentTemplate = (props: AttachmentProps) => html`
  <pc-bookmark-attachment name="${props.name}">
    <details ${props.open ? "open" : ""}>
      <summary>${props.title}</summary>
      <section>${props.content}</section>
    </details>
  </pc-bookmark-attachment>
`;

type AttachmentFormatter = (
  bookmark: BookmarkWithPermissions
) => Omit<AttachmentProps, "open"> | undefined;

const attachmentFormatters: Record<string, AttachmentFormatter> = {
  notes: (bookmark) => {
    if (bookmark.extended)
      return {
        name: "notes",
        title: "Notes",
        content: html`<section class="p-summary">${bookmark.extended}</section>`,
      };
  },
  feed: (bookmark) => {
    const feedUrl = bookmark.meta?.unfurl?.feed || bookmark.meta?.opml?.xmlUrl;
    if (feedUrl)
      return {
        name: "feed",
        title: "Feed",
        content: html`<pc-feed url="${feedUrl}" />`,
      };
  },
  embed: (bookmark) => {
    const unfurl = bookmark.meta?.unfurl;
    const iframeUrl =
      unfurl?.iframe &&
      `data:text/html;base64,${Buffer.from(unfurl?.iframe).toString("base64")}`;
    if (iframeUrl)
      return {
        name: "embed",
        title: "Embed",
        content: html`<iframe frameborder="0" src="${iframeUrl}"></iframe>`,
      };
  },
  unfurl: (bookmark) => {
    const unfurl = bookmark.meta?.unfurl;
    if (unfurl)
      return {
        name: "unfurl",
        title: "Unfurl",
        content: html`<textarea rows="15" style="width: 90%">${unfurl}</textarea>`,
      };
  },
  opml: (bookmark) => {
    const opml = bookmark.meta?.opml;
    if (opml)
      return {
        name: "opml",
        title: "OPML",
        content: html`<textarea rows="8" style="width: 90%">${opml}</textarea>`,
      };
  },
};
