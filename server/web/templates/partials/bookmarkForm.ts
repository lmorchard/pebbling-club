import { html } from "../../utils/html";
import {
  field,
  textarea,
  FormData,
  FormValidationError,
} from "../../utils/forms";
import { NewBookmarkQuerystringSchema } from "../../../services/bookmarks";
import { FromSchema } from "json-schema-to-ts";
import { UnfurlMetadata } from "../../../services/unfurl";

export interface Props {
  csrfToken: string;
  formData?: FromSchema<typeof NewBookmarkQuerystringSchema>;
  unfurlResult?: UnfurlMetadata;
  validationError?: FormValidationError;
  actionButtonTitle?: string;
}

export default ({
  csrfToken,
  formData,
  unfurlResult,
  validationError,
  actionButtonTitle = "Add new bookmark",
}: Props) => {
  const f = field({ formData, validationError });
  return html`
    <section>
      <form action="" method="post">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        <input type="hidden" name="next" value="${formData?.next}" />
        ${f("URL", "href", { required: true, autofocus: !formData?.href })}
        ${f("Title", "title", { required: true })}
        ${f("Description", "extended", {
          type: textarea({ rows: 5 }),
        })}
        ${f("Tags", "tags", { autofocus: !!formData?.href })}
        <textarea hidden rows="24" name="unfurl">${JSON.stringify(unfurlResult, null, '  ')}</textarea>
        <section class="actions">
          <button type="submit">${actionButtonTitle}</button>
        </section>
      </form>
    </section>
  `;
};
