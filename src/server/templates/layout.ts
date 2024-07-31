import { html, TemplateContent } from "../utils/html";

export interface LayoutProps extends Express.Locals {}

export const layout = ({
  content,
  user,
  csrfToken,
  getFlashMessages,
}: { content: TemplateContent } & LayoutProps) => {
  const flashMessages = (["info", "warn", "error"] as const).map(
    (type) => [type, getFlashMessages(type)] as const
  );
  return html`
    <html>
      <head>
        <link rel="stylesheet" href="/index.css" />
        <script type="module" src="/index.js"></script>
      </head>
      <body>
        ${flashMessages.map(
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
              <form action="/auth/logout" method="post">
                <button type="submit">
                  Logout (${user.username} (${user.id}))
                </button>
                <input type="hidden" name="_csrf" value="${csrfToken}" />
              </form>
            `
          : html`<a href="/auth/login">login</a>`}
        ${content}
      </body>
    </html>
  `;
};
