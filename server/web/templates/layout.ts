import _ from "lodash";
import { Profile } from "../../services/profiles";
import { html, TemplateContent, ITemplateProps } from "../utils/html";
import newBookmarklet from "./partials/newBookmarklet";
import Page, { PageProps } from "./page";

export interface LayoutProps extends ITemplateProps {
  minimalLayout?: boolean;
  user?: Profile;
  forceRefresh?: boolean;
  siteUrl?: string;
}

export const layout = ({
  minimalLayout = false,
  content,
  user,
  forceRefresh,
  siteUrl,
  htmlHead: htmlHeadIn,
  ...pageProps
}: { content: TemplateContent } & LayoutProps & PageProps) => {
  const newUrl = new URL("/new", siteUrl!).toString();
  const bookmarkletSrc = newBookmarklet({ newUrl });
  const bookmarkletPopupSrc = newBookmarklet({ newUrl, popup: true });

  return Page({
    ...pageProps,
    minimalLayout,
    htmlHead: html`
      ${htmlHeadIn}
      ${
        user &&
        html`
        <script type="application/json" id="user">${_.pick(user, [
          "username",
          "bio",
          "avatar",
        ])}</script>
      `
      }
      ${
        forceRefresh &&
        html`
        <script type="application/json" id="forceRefresh">${{
          forceRefresh: true,
        }}</script>
      `
      }
    `,
    content: minimalLayout
      ? content
      : html`
        <header class="site">
          <section class="masthead">
            <h1>
              <a href="${user ? `/u/${user.username}` : "/"}"
                >Pebbling Club 🐧🪨</a
              >
            </h1>
          </section>
          <nav>
            <theme-selector title="Enable dark theme">
              <label>
                <input type="checkbox" />
                <span class="slider"></span>
              </label>
            </theme-selector>
            ${
              user
                ? html`
                  <a class="newBookmark" href="/new">+ New</a>
                  <details class="autoclose">
                    <summary>
                      <span>${user.username}</span>
                    </summary>
                    <div>
                      <a href="/new">+ New</a>
                      <a href="/u/${user.username}">Profile</a>
                      <a href="/settings">Settings</a>
                      <a href="${bookmarkletSrc}">Bookmarklet</a>
                      <a href="${bookmarkletPopupSrc}">Bookmarklet (popup)</a>
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
                `
            }
          </nav>
        </header>

        ${content}

        <footer></footer>
      `,
  });
};
