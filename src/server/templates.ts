import { html, TemplateContent } from "../utils/html";

export type GlobalProps = { user?: Express.User; csrfToken: string };

export const layout = ({
  content,
  user,
  csrfToken,
}: { content: TemplateContent } & GlobalProps) => html`
  <html>
    <head> </head>
    <body>
      ${user
        ? html`
            <form action="/auth/logout" method="post">
              <button type="submit">Logout (${user.username} (${user.id}))</button>
              <input type="hidden" name="_csrf" value="${csrfToken}" />
            </form>
          `
        : html`<a href="/auth/login">login</a>`}
      ${content}
    </body>
  </html>
`;

export const index = ({ ...globalProps }: {} & GlobalProps) =>
  layout({
    ...globalProps,
    content: html` <h1>HELLO WORLD</h1> `,
  });

export const login = ({ ...globalProps }: {} & GlobalProps) =>
  layout({
    ...globalProps,
    content: html`
      <h1>Login</h1>
      <section>
        <form action="/auth/login/password" method="post">
          <section>
            <label for="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autocomplete="username"
              required
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
              required
            />
          </section>
          <input type="hidden" name="_csrf" value="${globalProps.csrfToken}" />
          <button type="submit">Sign in</button>
        </form>
        <hr />
        <p class="help">
          Don't have an account? <a href="/auth/signup">Sign up</a>
        </p>
      </section>
    `,
  });

export const signup = ({ ...globalProps }: {} & GlobalProps) =>
  layout({
    ...globalProps,
    content: html`
      <h1>Sign up</h1>
      <section>
        <form action="/auth/signup" method="post">
          <section>
            <label for="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autocomplete="username"
              required
            />
          </section>
          <section>
            <label for="new-password">Password</label>
            <input
              id="new-password"
              name="password"
              type="password"
              autocomplete="new-password"
              required
            />
          </section>
          <input type="hidden" name="_csrf" value="${globalProps.csrfToken}" />
          <button type="submit">Sign up</button>
        </form>
        <hr />
        <p class="help">
          Already have an account? <a href="/auth/login">Sign in</a>
        </p>
      </section>
    `,
  });
