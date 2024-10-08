import { html } from "../../utils/html";
import {
  field,
  FormData,
  FormErrors,
  FormValidationError,
} from "../../utils/forms";
import { layout, LayoutProps } from "../layout";

export interface Props extends LayoutProps {
  formData?: FormData;
  validationError?: FormValidationError;
}

export default ({ formData, validationError, ...locals }: Props) => {
  const f = field({ formData, validationError });
  return layout({
    ...locals,
    title: "Login",
    content: html`
      <h1>Login</h1>
      ${locals.messages}
      <section>
        <form action="" method="post">
          <input type="hidden" name="_csrf" value="${locals.csrfToken}" />
          ${f("Username", "username", { required: true, autofocus: true })}
          ${f("Password", "password", { required: true, type: "password" })}
          <section class="actions">
            <button type="submit">Sign in</button>
          </section>
        </form>
        <hr />
        <p class="help">Don't have an account? <a href="/signup">Sign up</a></p>
      </section>
    `,
  });
};
