import { FastifyRequest } from "fastify";

export type ListBookmarksQuerystringOptions = {
  limit?: string;
  offset?: string;
  show?: string;
  open?: string;
  order?: string;
  since?: string;
};

export function parseBookmarkListOptions(
  queryIn: ListBookmarksQuerystringOptions,
  defaults: Partial<ListBookmarksQuerystringOptions> = {}
) {
  const query = { ...defaults, ...queryIn };
  const limit = parseInt((query.limit as string) || "50", 10);
  const offset = parseInt((query.offset as string) || "0", 10);
  const show = query.show ? query.show.split(",") : undefined;
  const open = query.open ? query.open : undefined;
  const order = query.order ? query.order : undefined;
  const since = query.since ? query.since : undefined;
  return { limit, offset, show, open, order, since };
}

export function parseRefreshHeaders(request: FastifyRequest) {
  const { "cache-control": cacheControlHeader } = request.headers;
  const forceRefresh = cacheControlHeader === "no-cache";
  return { forceRefresh };
}
