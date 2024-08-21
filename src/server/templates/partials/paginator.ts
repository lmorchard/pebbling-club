import { isNullOrUndefined } from "util";
import { html } from "../../utils/html";

export interface Props {
  baseUrl?: string;
  total: number;
  limit: number;
  offset: number;
  limitChoices?: number[];
}

export default ({
  baseUrl = "",
  total,
  limit,
  offset,
  limitChoices = [10, 25, 50, 100, 250],
}: Props) => {
  let prevUrl;
  if (offset > 0) {
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: (Math.max(0, offset - limit)).toString(),
    });
    prevUrl = `${baseUrl}?${searchParams.toString()}`;
  }

  let nextUrl;
  if (offset + limit < total) {
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: (Math.min(total - limit, offset + limit)).toString(),
    });
    nextUrl = `${baseUrl}?${searchParams.toString()}`;
  }

  const limitChoicesUrls = limitChoices.map((choice) => {
    const searchParams = new URLSearchParams({
      limit: choice.toString(),
      offset: offset.toString(),
    });
    return {
      choice,
      url: `${baseUrl}?${searchParams.toString()}`
    };
  });

  return html`
    <div class="pagination">
      <div class="directions">
        ${prevUrl && html`<a class="previous" href="${prevUrl}">previous</a>`}
        ${nextUrl && html`<a class="next" href="${nextUrl}">next</a>`}
      </div>
      <div class="limitChoices">
        <span>items</span>
        ${limitChoicesUrls.map(({ choice, url }) => html`
          <a href="${url}">${choice}</a>
        `)}
      </div>
    </div>
  `;
};
