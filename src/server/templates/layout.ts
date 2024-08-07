import { Profile } from "../../services/profiles";
import { html, TemplateContent } from "../utils/html";
import { ITemplateProps } from "../utils/templates";

export interface LayoutProps extends ITemplateProps {
  user?: Profile;
  flash?: Record<"info" | "warn" | "error", string[]>;
}

export const layout = ({
  content,
  user,
  flash,
}: { content: TemplateContent } & LayoutProps) => {
  return html`
    <html>
      <head>
        <meta http-equiv="content-type" content="text/html; charset=utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
        <link rel="stylesheet" href="/index.css" />
        <script type="module" src="/index.js"></script>
      </head>
      <body>
        ${Object.entries(flash || {}).forEach(
          ([type, messages]) =>
            messages?.length &&
            html`
              <section class="flash ${type}">
                ${messages.map(
                  (message) =>
                    html`<div class="message ${type}">${message}</div>`
                )}
              </section>
            `
        )}
        ${user
          ? html`
              <h1>
                Welcome <a href="/u/${user.username}">${user.username}</a>
              </h1>
              <form action="/logout" method="post">
                <button type="submit">
                  Logout (${user.username} (${user.id}))
                </button>
              </form>
            `
          : html`<a href="/login">login</a>`}
        ${content}
      </body>
    </html>
  `;
};
