import { html } from "../../utils/html";
import {
  field,
  textarea,
  FormData,
  FormValidationError,
} from "../../utils/forms";
import {
  BookmarkWithPermissions,
} from "../../../services/bookmarks";
import { FromSchema } from "json-schema-to-ts";
import { UnfurlResult } from "../../../services/unfurl";
import { NewBookmarkQuerystringSchema } from "../../bookmarks";

export interface Props {
  csrfToken: string;
  formData?: FromSchema<typeof NewBookmarkQuerystringSchema>;
  unfurlResult?: UnfurlResult;
  existingBookmark?: BookmarkWithPermissions;
  validationError?: FormValidationError;
  actionButtonTitle?: string;
}

export default ({
  csrfToken,
  formData,
  unfurlResult,
  existingBookmark,
  validationError,
  actionButtonTitle = "Add new bookmark",
}: Props) => {
  const f = field({ formData, validationError });
  return html`
    <pc-bookmark-form>
      <form action="" method="post">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <input type="hidden" name="next" value="${formData?.next}" />
        ${f("URL", "href", { required: true, autofocus: !formData?.href })}
        ${f("Title", "title", { required: true })}
        ${f("Description", "extended", {
          type: textarea({ rows: 5 }),
        })}
        ${f("Tags", "tags", { autofocus: !!formData?.href })}
        ${existingBookmark
          ? html`<span class="previously-saved"
              >Previously saved at
              <a href="/bookmarks/${existingBookmark.id}"
                >${existingBookmark.created?.toISOString()}</a
              ></span
            >`
          : ""}
        <details class="unfurl-data">
          <summary>
            <span>Unfurl data</span>
          </summary>
          <a href="#" class="refresh">Refresh unfurl data</a>
          <textarea rows="24" name="unfurl">${JSON.stringify(unfurlResult, null, "  ")}</textarea>
        </details>
        <section class="actions">
          <button default type="submit">${actionButtonTitle}</button>
        </section>
      </form>
    </pc-bookmark-form>
  `;
};
