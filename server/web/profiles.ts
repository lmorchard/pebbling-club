import Boom from "@hapi/boom";
import templateProfileIndex from "./templates/profile/index";
import { IBaseRouterOptions } from "./types";
import { FastifyPluginAsync } from "fastify";
import { Profile } from "../services/profiles";
import { TagCount } from "../services/bookmarks";

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
  function parseLimitOffset(query: { limit?: string; offset?: string }) {
    const limit = parseInt((query.limit as string) || "50", 10);
    const offset = parseInt((query.offset as string) || "0", 10);
    return { limit, offset };
  }

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
    request.tagCounts = await bookmarks.listTagsForOwner(profile.id, 250, 0);
  });

  fastify.get<{
    Params: { username: string };
    Querystring: { limit?: string; offset?: string };
  }>("/:username", async (request, reply) => {
    const { bookmarks } = options.server.app;
    const { limit, offset } = parseLimitOffset(request.query);
    const viewerId = request.user?.id;

    const profile = request.profile as Profile;

    const { total: bookmarksTotal, items: bookmarksItems } =
      await bookmarks.listForOwner(viewerId, profile.id, limit, offset);

    return reply.renderTemplate(templateProfileIndex, {
      profile,
      limit,
      offset,
      tagCounts: request.tagCounts!,
      total: bookmarksTotal,
      bookmarks: bookmarksItems,
    });
  });

  fastify.get<{
    Params: { username: string; tags: string };
    Querystring: { limit?: string; offset?: string };
  }>("/:username/t/:tags", async (request, reply) => {
    const { bookmarks } = options.server.app;
    const { tags } = request.params;
    const { limit, offset } = parseLimitOffset(request.query);
    const viewerId = request.user?.id;

    const profile = request.profile as Profile;

    const { total: bookmarksTotal, items: bookmarksItems } =
      await bookmarks.listForOwnerByTags(
        viewerId,
        profile.id,
        tags.split(/[\+ ]+/g),
        limit,
        offset
      );

    // TODO: use a different template? allow per-user annotation / description of tag
    return reply.renderTemplate(templateProfileIndex, {
      profile,
      limit,
      offset,
      tagCounts: request.tagCounts!,
      total: bookmarksTotal,
      bookmarks: bookmarksItems,
    });
  });
};
