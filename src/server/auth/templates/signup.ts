import { html } from "../../../utils/html";
import { layout, LayoutProps } from "../../common/templates/layout";

export interface Props extends LayoutProps {}

export default ({ ...layoutProps }: Props) =>
  layout({
    ...layoutProps,
    content: html`
      <h1>Sign up</h1>
      <section>
        <form action="/auth/signup" method="post">
          <section>
            <label for="username">Username</label>
            <input id="username" name="username" type="text" required />
          </section>
          <section>
            <label for="new-password">Password</label>
            <input id="new-password" name="password" type="password" required />
          </section>
          <section>
            <label for="new-password-confirm">Password (confirm)</label>
            <input id="new-password-confirm" name="password-confirm" type="password" />
          </section>
          <input type="hidden" name="_csrf" value="${layoutProps.csrfToken}" />
          <button type="submit">Sign up</button>
        </form>
        <hr />
        <p class="help">
          Already have an account? <a href="/auth/login">Sign in</a>
        </p>
      </section>
    `,
  });
