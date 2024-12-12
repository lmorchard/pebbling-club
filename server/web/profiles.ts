import Boom from "@hapi/boom";
import templateProfileIndex from "./templates/profile/index";
import templateProfileFeed, {
  FeedFormats,
  constructFeedTitle,
  constructFeedUrl,
} from "./templates/profile/feed";
import { IBaseRouterOptions } from "./types";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { Profile } from "../services/profiles";
import { TagCount } from "../services/bookmarks";
import {
  ListBookmarksQuerystringOptions,
  parseBookmarkListOptions,
  parseRefreshHeaders,
} from "./utils/routes";

declare module "fastify" {
  export interface FastifyRequest {
    profile?: Profile;
    tagCounts?: TagCount[];
  }
}

export interface IProfilesRouterOptions extends IBaseRouterOptions {}

export const ProfilesRouter: FastifyPluginAsync<
  IProfilesRouterOptions
> = async (fastify, options) => {
  fastify.decorateRequest("profile", null);

  fastify.addHook<{
    Params: { username: string };
  }>("preHandler", async (request, reply) => {
    const { profiles, bookmarks } = options.server.app;
    const { username } = request.params;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) throw Boom.notFound(`profile ${username} not found`);

    request.profile = profile;
    // TODO: limit for tags list?
    request.tagCounts = await bookmarks.listTagsForOwner(profile.id, 25, 0);
  });

  fastify.get<{
    Params: { username: string };
    Querystring: ListBookmarksQuerystringOptions;
  }>("/:username", async (request, reply) => {
    return handleProfileRequest(request, reply, options, false);
  });

  fastify.get<{
    Params: { username: string; format: string };
    Querystring: ListBookmarksQuerystringOptions;
  }>("/:username/feed.:format", async (request, reply) => {
    return handleProfileFeedRequest(request, reply, options, false);
  });

  fastify.get<{
    Params: { username: string; tags: string };
    Querystring: ListBookmarksQuerystringOptions;
  }>("/:username/t/:tags", async (request, reply) => {
    return handleProfileRequest(request, reply, options, true);
  });

  fastify.get<{
    Params: { username: string; tags: string; format: string };
    Querystring: ListBookmarksQuerystringOptions;
  }>("/:username/t/:tags/feed.:format", async (request, reply) => {
    return handleProfileFeedRequest(request, reply, options, true);
  });

  async function handleProfileRequest(
    request: FastifyRequest<{
      Params: { username: string; tags?: string };
      Querystring: ListBookmarksQuerystringOptions;
    }>,
    reply: FastifyReply,
    options: IProfilesRouterOptions,
    isTagRequest: boolean
  ) {
    const { bookmarks, config } = options.server.app;
    const { username, tags } = request.params;
    const profile = request.profile as Profile;
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
      tagCounts: request.tagCounts!,
      total: bookmarksTotal,
      bookmarks: bookmarksItems,
      feedTitle,
      feedUrl,
    });
  }

  const feedContentTypes: Record<FeedFormats, string> = {
    [FeedFormats.rss]: "application/rss+xml",
    [FeedFormats.atom]: "application/atom+xml",
    [FeedFormats.json]: "application/json",
  };

  async function handleProfileFeedRequest(
    request: FastifyRequest<{
      Params: { username: string; format?: string; tags?: string };
      Querystring: ListBookmarksQuerystringOptions;
    }>,
    reply: FastifyReply,
    options: IProfilesRouterOptions,
    isTagFeed: boolean
  ) {
    const { bookmarks, config } = options.server.app;
    const { username, format, tags } = request.params;
    const profile = request.profile as Profile;
    const listOptions = parseBookmarkListOptions(request.query, {
      limit: "15",
    });

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
    bookmarksService: any,
    userId: string | undefined,
    profileId: string,
    listOptions: any,
    tags?: string
  ) {
    if (tags) {
      return bookmarksService.listForOwnerByTags(
        userId,
        profileId,
        tags.split(/[\+ ]+/g),
        listOptions
      );
    } else {
      return bookmarksService.listForOwner(userId, profileId, listOptions);
    }
  }
};
