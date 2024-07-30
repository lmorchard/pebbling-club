import { html, TemplateContent } from "../../../utils/html";

export interface LayoutProps {
  user?: Express.User;
  csrfToken: string;
  messages?: string[];
};

export const layout = ({
  content,
  user,
  csrfToken,
  messages,
}: { content: TemplateContent } & LayoutProps) => html`
  <html>
    <head> </head>
    <body>
      ${messages}
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
