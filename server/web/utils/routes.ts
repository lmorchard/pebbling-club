import { FastifyRequest } from "fastify";

export type BookmarkListOptions = {
  limit?: string;
  offset?: string;
  show?: string;
  open?: string;
};

export function parseBookmarkListOptions(query: BookmarkListOptions) {
  const limit = parseInt((query.limit as string) || "50", 10);
  const offset = parseInt((query.offset as string) || "0", 10);
  const show = query.show ? query.show.split(",") : undefined;
  const open = query.open ? query.open : undefined;
  return { limit, offset, show, open };
}

export function parseRefreshHeaders(request: FastifyRequest) {
  const { "cache-control": cacheControlHeader } = request.headers;
  const forceRefresh = cacheControlHeader === "no-cache";
  return { forceRefresh };
}
