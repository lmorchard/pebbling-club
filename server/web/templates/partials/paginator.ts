import { isNullOrUndefined } from "util";
import { html } from "../../utils/html";

export interface Props {
  baseUrl?: string;
  showAttachments?: string[];
  openAttachment?: string;
  total: number;
  limit: number;
  offset: number;
  limitChoices?: number[];
}

function pageParams(props: Props) {
  const { limit, offset, showAttachments, openAttachment } = props;
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (showAttachments) params.append("show", showAttachments.join(","));
  if (openAttachment) params.append("open", openAttachment);
  return params.toString();
}

export default (props: Props) => {
  const {
    baseUrl = "",
    total,
    limit,
    offset,
    limitChoices = [10, 25, 50, 100, 250],
  } = props;

  let prevUrl;
  if (offset > 0) {
    prevUrl = `${baseUrl}?${pageParams({
      ...props,
      offset: Math.max(0, offset - limit),
    })}`;
  }

  let nextUrl;
  if (offset + limit < total) {
    nextUrl = `${baseUrl}?${pageParams({
      ...props,
      offset: Math.min(total - limit, offset + limit),
    })}`;
  }

  const limitChoicesUrls = limitChoices.map((choice) => {
    return {
      choice,
      url: `${baseUrl}?${pageParams({ ...props, limit: choice })}`,
    };
  });

  return html`
    <div class="pagination">
      <div class="directions">
        ${prevUrl && html`<a class="previous" href="${prevUrl}">previous</a>`}
        <span>${offset || "0"} - ${offset + limit} of ${total} items</span>
        ${nextUrl && html`<a class="next" href="${nextUrl}">next</a>`}
      </div>
      <div class="limitChoices">
        ${limitChoicesUrls.map(
          ({ choice, url }) => html`
          <a href="${url}">${choice}</a>
        `
        )}
      </div>
    </div>
  `;
};
