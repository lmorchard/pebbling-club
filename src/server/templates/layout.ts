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
        <details-closer>
          <header class="site">
            <section class="masthead">
              <h1><a href="/">Pebbling Club 🐧🪨</a></h1>
            </section>
            <nav>
              ${user
                ? html`
                    <details class="autoclose">
                      <summary>
                        <span>${user.username}</span>
                      </summary>
                      <div>
                        <a href="/u/${user.username}">Profile</a>
                        <a href="/settings">Settings</a>
                        <form action="/logout" method="post">
                          <button type="submit">Logout</button>
                        </form>
                      </div>
                    </details>
                  `
                : html`
                    <details class="autoclose">
                      <summary>Welcome!</summary>
                      <div>
                        <a href="/signup">Signup</a>
                        <a href="/login">Login</a>
                      </div>
                    </details>
                  `}
            </nav>
          </header>

          ${content}

          <footer></footer>
        </details-closer>
      </body>
    </html>
  `;
};
