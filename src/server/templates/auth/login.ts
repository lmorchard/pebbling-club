import { html } from "../../utils/html";
import { field } from "../../utils/forms";
import { layout, LayoutProps } from "../layout";

export interface Props extends LayoutProps {}

export default ({ ...locals }: Props) => {
  const { validation, formData } = locals;
  const f = field(validation, formData);

  return layout({
    ...locals,
    content: html`
      <h1>Login</h1>
      ${locals.messages}
      <section>
        <form action="/auth/login" method="post">
          <input type="hidden" name="_csrf" value="${locals.csrfToken}" />
          ${f("Username", "username", { required: true, autofocus: true })}
          ${f("Password", "password", { required: true, type: "password" })}
          <button type="submit">Sign in</button>
        </form>
        <hr />
        <p class="help">
          Don't have an account? <a href="/auth/signup">Sign up</a>
        </p>
      </section>
    `,
  });
};
