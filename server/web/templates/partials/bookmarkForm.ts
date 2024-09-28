import { html } from "../../utils/html";
import {
  field,
  textarea,
  FormData,
  FormValidationError,
} from "../../utils/forms";

export interface Props {
  csrfToken: string;
  formData?: FormData;
  validationError?: FormValidationError;
  actionButtonTitle?: string;
}

export default ({
  csrfToken,
  formData,
  validationError,
  actionButtonTitle = "Add new bookmark",
}: Props) => {
  const f = field({ formData, validationError });
  return html`
    <section>
      <form action="" method="post">
        <input type="hidden" name="_csrf" value="${csrfToken}" />
        ${f("URL", "href", { required: true, autofocus: !formData?.href })}
        ${f("Title", "title", { required: true })}
        ${f("Description", "extended", {
          type: textarea({ rows: 5 }),
        })}
        ${f("Tags", "tags", { autofocus: formData?.href })}
        <section class="actions">
          <button type="submit">${actionButtonTitle}</button>
        </section>
      </form>
    </section>
  `;
};
