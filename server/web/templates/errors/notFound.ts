import { html } from "../../utils/html";
import { layout, LayoutProps } from "../layout";

export interface Props extends LayoutProps {
  error?: Error | string;
}

export default ({ error, ...locals }: Props) => {
  // TODO: Need a prod / dev switch here to obscure error messages in prod
  let errorMessage;
  if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = "" + error;
  }
  return layout({
    ...locals,
    title: "Not Found",
    content: html`
      <h1>Not Found</h1>
      ${errorMessage}
    `,
  });
};
