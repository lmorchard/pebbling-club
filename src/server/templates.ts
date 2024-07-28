import { html, TemplateContent } from "../utils/html";

export type LayoutProps = { content: TemplateContent };

export const layout = ({ content }: LayoutProps) => html`
  <html>
  <head>
  </head>
  <body>
    ${content}
  </body>
  </html>
`;
