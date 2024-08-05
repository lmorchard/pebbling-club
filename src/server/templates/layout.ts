import { Profile } from "../../services/profiles";
import { html, TemplateContent } from "../utils/html";
import { ITemplateProps } from "../utils/templates";

export interface LayoutProps extends ITemplateProps {
  user?: Profile;
  csrfToken?: string;
  flash?: Record<"info" | "warn" | "error", string[]>;
}

export const layout = ({
  content,
  user,
  csrfToken,
  flash,
}: { content: TemplateContent } & LayoutProps) => {
  return html`
    <html>
      <head>
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
                <input type="hidden" name="_csrf" value="${csrfToken}" />
              </form>
            `
          : html`<a href="/login">login</a>`}
        ${content}
      </body>
    </html>
  `;
};
