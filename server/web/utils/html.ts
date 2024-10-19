import escapeHtml from "escape-html";

export type TemplateContent = string | (() => string);

export interface ITemplateProps extends Record<string, any> {}

export type RenderableTemplate<P extends ITemplateProps> = (
  props: P
) => TemplateContent;

export const html =
  (strings: TemplateStringsArray, ...values: any[]) =>
  () =>
    strings
      .reduce((result, string, i) => result + string + htmlValue(values[i]), "")
      .trim();

const htmlValue = (
  value: string | (() => string) | string[] | Record<string, any>
): string => {
  if (!value) {
    return "";
  } else if (typeof value === "function") {
    return value();
  } else if (Array.isArray(value)) {
    return value.map(htmlValue).join("");
  } else if (typeof value === "object") {
    return JSON.stringify(value, null, "  ");
  }
  return escapeHtml(value);
};

export const unescaped = (raw: string) => () => raw;

export const urlencode = (raw: string) => () =>
  escapeHtml(encodeURIComponent(raw));

export const render = (content: TemplateContent): string =>
  typeof content === "function" ? content() : content;
