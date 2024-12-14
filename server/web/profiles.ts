import Boom from "@hapi/boom";
import templateProfileIndex from "./templates/profile/index";
import templateProfileFeed, {
  constructFeedTitle,
  constructFeedUrl,
} from "./templates/profile/feed";
import { FeedFormats, IBaseRouterOptions } from "./types";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { BookmarksService } from "../services/bookmarks";
import {
  BookmarksListRouteQuerystringOptions,
  parseBookmarkListOptions,
  BookmarksListRouteOptions,
  parseRefreshHeaders,
  feedContentTypes,
} from "./utils/routes";

export interface IProfilesRouterOptions extends IBaseRouterOptions {}

export const ProfilesRouter: FastifyPluginAsync<
  IProfilesRouterOptions
> = async (fastify, options) => {
  fastify.get<{
    Params: { username: string };
    Querystring: BookmarksListRouteQuerystringOptions;
  }>("/:username", async (request, reply) => {
    return handleProfileRequest(request, reply, options, false);
  });

  fastify.get<{
    Params: { username: string; format: string };
    Querystring: BookmarksListRouteQuerystringOptions;
  }>("/:username/feed.:format", async (request, reply) => {
    return handleProfileFeedRequest(request, reply, options, false);
  });

  fastify.get<{
    Params: { username: string; tags: string };
    Querystring: BookmarksListRouteQuerystringOptions;
  }>("/:username/t/:tags", async (request, reply) => {
    return handleProfileRequest(request, reply, options, true);
  });

  fastify.get<{
    Params: { username: string; tags: string; format: string };
    Querystring: BookmarksListRouteQuerystringOptions;
  }>("/:username/t/:tags/feed.:format", async (request, reply) => {
    return handleProfileFeedRequest(request, reply, options, true);
  });

  async function handleProfileRequest(
    request: FastifyRequest<{
      Params: { username: string; tags?: string };
      Querystring: BookmarksListRouteQuerystringOptions;
    }>,
    reply: FastifyReply,
    options: IProfilesRouterOptions,
    isTagRequest: boolean
  ) {
    const { bookmarks, profiles, config } = options.server.app;
    const { username, tags } = request.params;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) throw Boom.notFound(`profile ${username} not found`);

    const { forceRefresh } = parseRefreshHeaders(request);
    const listOptions = parseBookmarkListOptions(request.query);

    const { total: bookmarksTotal, items: bookmarksItems } =
      await fetchBookmarks(
        bookmarks,
        request.user?.id,
        profile.id,
        listOptions,
        tags
      );

    const tagCounts = await bookmarks.listTagsForOwner(profile.id, 25, 0);

    const feedTitle = constructFeedTitle(
      config.get("siteName"),
      username,
      tags
    );

    const feedUrl = constructFeedUrl(
      config.get("siteUrl"),
      username,
      tags,
      FeedFormats.rss
    );

    return reply.renderTemplate(templateProfileIndex, {
      ...listOptions,
      profile,
      forceRefresh,
      tagCounts,
      total: bookmarksTotal,
      bookmarks: bookmarksItems,
      feedTitle,
      feedUrl,
    });
  }

  async function handleProfileFeedRequest(
    request: FastifyRequest<{
      Params: { username: string; format?: string; tags?: string };
      Querystring: BookmarksListRouteQuerystringOptions;
    }>,
    reply: FastifyReply,
    options: IProfilesRouterOptions,
    isTagFeed: boolean
  ) {
    const { bookmarks, profiles, config } = options.server.app;
    const { username, format, tags } = request.params;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) throw Boom.notFound(`profile ${username} not found`);

    const listOptions = parseBookmarkListOptions(request.query);

    const { items: bookmarksItems } = await fetchBookmarks(
      bookmarks,
      request.user?.id,
      profile.id,
      listOptions,
      tags
    );

    const contentType =
      feedContentTypes[format as FeedFormats] ||
      feedContentTypes[FeedFormats.rss];

    const title = constructFeedTitle(config.get("siteName"), username, tags);

    const feedUrl = constructFeedUrl(
      config.get("siteUrl"),
      username,
      tags,
      FeedFormats.rss
    );

    // TODO: need some reverse routing utils to generate these URLs
    const siteUrl = config.get("siteUrl");
    const link = new URL(
      isTagFeed ? `/u/${username}/t/${tags}` : `/u/${username}`,
      siteUrl
    ).toString();

    return reply.renderTemplate(
      templateProfileFeed,
      {
        id: feedUrl,
        format: FeedFormats[format as keyof typeof FeedFormats],
        title,
        bookmarks: bookmarksItems,
        copyright: "",
        generator: "Pebbling Club",
        link,
      },
      contentType
    );
  }

  async function fetchBookmarks(
    bookmarks: BookmarksService,
    userId: string | undefined,
    profileId: string,
    listOptions: BookmarksListRouteOptions,
    tagsIn?: string
  ) {
    const tags = tagsIn && tagsIn.split(/[\+ ]+/g);
    const { q } = listOptions;
    if (q) {
      return bookmarks.searchForOwner(
        userId,
        profileId,
        q,
        tags || [],
        listOptions
      );
    } else if (tags) {
      return bookmarks.listForOwnerByTags(userId, profileId, tags, listOptions);
    } else {
      return bookmarks.listForOwner(userId, profileId, listOptions);
    }
  }
};
