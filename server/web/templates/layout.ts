import { Profile } from "../../services/profiles";
import { html, TemplateContent } from "../utils/html";
import { ITemplateProps } from "../utils/templates";
import Page from "./page";

export interface LayoutProps extends ITemplateProps {
  user?: Profile;
  siteUrl?: string;
}

export const layout = ({
  content,
  user,
  siteUrl,
}: { content: TemplateContent } & LayoutProps) => {
  const newUrl = new URL('/new', siteUrl!).toString();

  return Page({
    content: html`
      <header class="site">
        <section class="masthead">
          <h1><a href="/">Pebbling Club 🐧🪨</a></h1>
        </section>
        <nav>
          <theme-selector title="Enable dark theme">
            <label>
              <input type="checkbox" />
              <span class="slider"></span>
            </label>
          </theme-selector>
          ${user
            ? html`
                <a class="newBookmark" href="/new">+ New</a>
                <details class="autoclose">
                  <summary>
                    <span>${user.username}</span>
                  </summary>
                  <div>
                    <a href="/u/${user.username}">Profile</a>
                    <a href="/settings">Settings</a>
                    <a
                      href="javascript:if(document.getSelection){s=document.getSelection();}else{s='';};document.location='${newUrl}?next=same&href='+encodeURIComponent(location.href)+'&extended='+encodeURIComponent(s)+'&title='+encodeURIComponent(document.title)+'&tags='+encodeURIComponent('%s')"
                      >Bookmarklet</a
                    >
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
