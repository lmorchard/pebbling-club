import { BookmarksListOptions } from "@/services/bookmarks";
import { FastifyRequest } from "fastify";
import { FeedFormats } from "../types";
import { stripDefaults, stripUndefined } from "../../utils/defaults";
import { convertProperties } from "../..//utils/convert";

export type BookmarksListRouteQuerystringOptions = {
  show?: string;
  open?: string;
  q?: string;
} & {
  [K in keyof BookmarksListOptions]?: string;
};

export type BookmarksListRouteOptions = {
  show?: string[];
  open?: string;
  q?: string;
} & BookmarksListOptions;

export const defaultBookmarksListRouteOptions: BookmarksListRouteOptions = {
  limit: 50,
  offset: 0,
  show: ["notes", "feed", "embed", "unfurl"],
  open: "notes",
};

export function parseBookmarkListOptions(
  options: BookmarksListRouteQuerystringOptions,
  defaults: BookmarksListRouteOptions = defaultBookmarksListRouteOptions
): BookmarksListRouteOptions {
  return convertProperties<BookmarksListRouteOptions>(
    {
      limit: (value) => parseInt(value),
      offset: (value) => parseInt(value),
      show: (value) => value.split(","),
    },
    options,
    defaults
  );
}

export function serializeBookmarkListOptions(
  options: BookmarksListRouteOptions,
  defaults: BookmarksListRouteOptions = defaultBookmarksListRouteOptions
): BookmarksListRouteQuerystringOptions {
  const { show, limit, offset, ...rest } = options;
  return stripUndefined(
    convertProperties<BookmarksListRouteQuerystringOptions>(
      {
        show: (value) => value.join(","),
        limit: (value) => value.toString(),
        offset: (value) => value.toString(),
      },
      stripDefaults<BookmarksListRouteOptions>(options, defaults)
    )
  );
}

export function parseRefreshHeaders(request: FastifyRequest) {
  const { "cache-control": cacheControlHeader } = request.headers;
  const forceRefresh = cacheControlHeader === "no-cache";
  return { forceRefresh };
}

export const feedContentTypes: Record<FeedFormats, string> = {
  [FeedFormats.rss]: "application/rss+xml",
  [FeedFormats.atom]: "application/atom+xml",
  [FeedFormats.json]: "application/json",
};
