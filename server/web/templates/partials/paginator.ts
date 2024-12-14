import { html } from "../../utils/html";
import {
  BookmarksListRouteOptions,
  serializeBookmarkListOptions,
} from "../../utils/routes";

export type Props = BookmarksListRouteOptions & {
  baseUrl?: string;
  total: number;
  limitChoices?: number[];
  stickyBottom?: boolean;
};

function pageParams(props: Props) {
  const { baseUrl, total, limitChoices, stickyBottom, ...options } = props;
  const params = new URLSearchParams(serializeBookmarkListOptions(options));
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
    <div class="pagination ${props.stickyBottom && "pagination-sticky-bottom"}">
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
