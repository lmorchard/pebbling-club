import { html } from "../../../utils/html";
import { layout, LayoutProps } from "../../common/templates/layout";
import { field } from "../../common/forms";

export interface Props extends LayoutProps {}

export default ({ ...locals }: Props) => {
  const { validation, formData } = locals;
  const f = field(validation, formData);

  return layout({
    ...locals,
    content: html`
      <h1>Sign up</h1>
      <section>
        <form action="/auth/signup" method="post">
          <input type="hidden" name="_csrf" value="${locals.csrfToken}" />
          ${f("Username", "username", { required: true })}
          ${f("Password", "password", { required: true, type: "password" })}
          ${f("Password (confirm)", "password-confirm", {
            required: true,
            type: "password",
          })}
          <button type="submit">Sign up</button>
        </form>
        <hr />
        <p class="help">
          Already have an account? <a href="/auth/login">Login</a>
        </p>
      </section>
    `,
  });
};
