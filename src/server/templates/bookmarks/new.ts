import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";
import { field, FormData, FormErrors, FormValidationError } from "../../utils/forms";

export interface Props extends LayoutProps {
  formData?: FormData,
  validationError?: FormValidationError,
}

export default ({ formData, validationError, ...locals }: Props) => {
  const f = field({ formData, validationError });
  return layout({
    ...locals,
    content: html`
      <section>
        <form action="" method="post">
          <input type="hidden" name="_csrf" value="${locals.csrfToken}" />
          ${f("URL", "href", { required: true })}
          ${f("Title", "title", { required: true })}
          ${f("Description", "extended")}
          ${f("Tags", "tags")}
          <section>
            <button type="submit">Add new bookmark</button>
          </section>
        </form>
      </section>
    `,
  });
};
