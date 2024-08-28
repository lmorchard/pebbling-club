import { Profile } from "../../services/profiles";
import { html, TemplateContent } from "../utils/html";
import { ITemplateProps } from "../utils/templates";
import Page from "./page";

export interface LayoutProps extends ITemplateProps {
  user?: Profile;
  flash?: Record<"info" | "warn" | "error", string[]>;
}

export const layout = ({
  content,
  user,
  flash,
}: { content: TemplateContent } & LayoutProps) => {
  return Page({
    content: html`
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
    `,
  });
};
