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
      <h1>Sign up</h1>
      <section>
        <form action="" method="post">
          <input type="hidden" name="_csrf" value="${locals.csrfToken}" />
          ${f("Username", "username", { required: true })}
          ${f("Password", "password", { required: true, type: "password" })}
          ${f("Password (confirm)", "password-confirm", {
            required: true,
            type: "password",
          })}
          <section class="actions">
            <button type="submit">Sign up</button>
          </section>
        </form>
        <hr />
        <p class="help">
          Already have an account? <a href="/login">Login</a>
        </p>
      </section>
    `,
  });
};
