import { Profile } from "../../services/profiles";
import { html, TemplateContent } from "../utils/html";
import { ITemplateProps } from "../utils/templates";

export interface PageProps extends ITemplateProps {}

export default ({ content }: { content: TemplateContent } & PageProps) => {
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
          <div class="content-grid-wrapper">
            <div class="content-grid">${content}</div>
          </div>
        </details-closer>
      </body>
    </html>
  `;
};
