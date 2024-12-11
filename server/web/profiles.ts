import Boom from "@hapi/boom";
import templateProfileIndex from "./templates/profile/index";
import templateProfileFeed, { FeedFormats } from "./templates/profile/feed";
import { IBaseRouterOptions } from "./types";
import { FastifyPluginAsync } from "fastify";
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
    const { bookmarks } = options.server.app;
    const profile = request.profile as Profile;
    const { forceRefresh } = parseRefreshHeaders(request);
    const listOptions = parseBookmarkListOptions(request.query);

    const { total: bookmarksTotal, items: bookmarksItems } =
      await bookmarks.listForOwner(
        request.user?.id,
        profile.id,
        listOptions
      );

    return reply.renderTemplate(templateProfileIndex, {
      ...listOptions,
      profile,
      forceRefresh,
      tagCounts: request.tagCounts!,
      total: bookmarksTotal,
      bookmarks: bookmarksItems,
    });
  });

  fastify.get<{
    Params: { username: string; format: string };
    Querystring: ListBookmarksQuerystringOptions;
  }>("/:username/feed.:format", async (request, reply) => {
    const { bookmarks } = options.server.app;
    const { username, format } = request.params;
    const profile = request.profile as Profile;
    const listOptions = parseBookmarkListOptions(request.query, {
      limit: "15",
    });

    const { items: bookmarksItems } = await bookmarks.listForOwner(
      request.user?.id,
      profile.id,
      listOptions
    );

    return reply.renderTemplate(templateProfileFeed, {
      id: `u/${username}`,
      format: FeedFormats[format as keyof typeof FeedFormats],
      profile,
      bookmarks: bookmarksItems,
    });
  });

  fastify.get<{
    Params: { username: string; tags: string };
    Querystring: ListBookmarksQuerystringOptions;
  }>("/:username/t/:tags", async (request, reply) => {
    const { bookmarks } = options.server.app;
    const { tags } = request.params;
    const profile = request.profile as Profile;
    const { forceRefresh } = parseRefreshHeaders(request);
    const listOptions = parseBookmarkListOptions(request.query);

    const { total: bookmarksTotal, items: bookmarksItems } =
      await bookmarks.listForOwnerByTags(
        request.user?.id,
        profile.id,
        tags.split(/[\+ ]+/g),
        listOptions
      );

    // TODO: use a different template? allow per-user annotation / description of tag
    return reply.renderTemplate(templateProfileIndex, {
      ...listOptions,
      profile,
      forceRefresh,
      tagCounts: request.tagCounts!,
      total: bookmarksTotal,
      bookmarks: bookmarksItems,
    });
  });

  fastify.get<{
    Params: { username: string; tags: string; format: string };
    Querystring: ListBookmarksQuerystringOptions;
  }>("/:username/t/:tags/feed.:format", async (request, reply) => {
    const { bookmarks } = options.server.app;
    const { username, format, tags } = request.params;
    const profile = request.profile as Profile;
    const listOptions = parseBookmarkListOptions(request.query, {
      limit: "15",
    });

    const { items: bookmarksItems } = await bookmarks.listForOwnerByTags(
      request.user?.id,
      profile.id,
      tags.split(/[\+ ]+/g),
      listOptions
    );

    return reply.renderTemplate(templateProfileFeed, {
      id: `u/${username}/t/${tags}`,
      format: FeedFormats[format as keyof typeof FeedFormats],
      profile,
      bookmarks: bookmarksItems,
    });
  });
};
