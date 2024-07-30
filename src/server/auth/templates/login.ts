import { html } from "../../../utils/html";
import { layout, LayoutProps } from "../../common/templates/layout";

export interface Props extends LayoutProps {
  info?: string;
}

export default ({ info, ...layoutProps }: Props) =>
  layout({
    ...layoutProps,
    content: html`
      <h1>Login</h1>
      <section>
        <form action="/auth/login" method="post">
          ${info}
          <section>
            <label for="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autocomplete="username"
              autofocus
            />
          </section>
          <section>
            <label for="current-password">Password</label>
            <input
              id="current-password"
              name="password"
              type="password"
              autocomplete="current-password"
            />
          </section>
          <input type="hidden" name="_csrf" value="${layoutProps.csrfToken}" />
          <button type="submit">Sign in</button>
        </form>
        <hr />
        <p class="help">
          Don't have an account? <a href="/auth/signup">Sign up</a>
        </p>
      </section>
    `,
  });
