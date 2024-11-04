import { html, TemplateContent, ITemplateProps } from "../utils/html";

export interface PageProps extends ITemplateProps {
  minimalLayout?: boolean;
  title?: string;
  htmlHead?: TemplateContent;
}

export default ({
  minimalLayout = false,
  title,
  htmlHead,
  content,
}: { content: TemplateContent } & PageProps) => {
  return html`<!DOCTYPE html>
    <html>
      <head>
        <title>${title && `${title} - `}Pebbling Club 🐧🪨</title>
        <meta http-equiv="content-type" content="text/html; charset=utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
        <link rel="stylesheet" href="/index.css" />
        <script type="module" src="/index.js"></script>
        ${htmlHead}
      </head>
      <body>
        <details-closer>
          ${
            minimalLayout
              ? content
              : html`
                  <div class="content-grid-wrapper">
                    <div class="content-grid">${content}</div>
                  </div>
              `
          }
        </details-closer>
      </body>
    </html>
  `;
};
