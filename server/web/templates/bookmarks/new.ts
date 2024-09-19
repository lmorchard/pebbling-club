import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";
import { field, FormData, FormValidationError } from "../../utils/forms";
import partialBookmarkForm from "../partials/bookmarkForm";

export interface Props extends LayoutProps {
  formData?: FormData;
  validationError?: FormValidationError;
}

export default ({ formData, validationError, ...locals }: Props) => {
  const { csrfToken } = locals;
  const f = field({ formData, validationError });
  return layout({
    ...locals,
    content: html`
      <section>
        ${partialBookmarkForm({ csrfToken, formData, validationError })}
      </section>
    `,
  });
};
