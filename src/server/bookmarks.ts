import Boom from "@hapi/boom";
import { FastifyPluginAsync } from "fastify";
import { FromSchema } from "json-schema-to-ts";
import validator from "validator";
import {
  BookmarkCreatable, BookmarksService,
  NewBookmarkQuerystringSchema,
  NewBookmarkSchema
} from "../services/bookmarks";
import { RequirePasswordAuth } from "./auth";
import templateBookmarksEdit from "./templates/bookmarks/edit";
import templateBookmarksNew from "./templates/bookmarks/new";
import templateBookmarksView from "./templates/bookmarks/view";
import templateBookmarksDelete from "./templates/bookmarks/delete";
import { IBaseRouterOptions } from "./types";
import { addValidationError, FormValidationError } from "./utils/forms";

export interface IBookmarksRouterOptions extends IBaseRouterOptions {
  services: {
    bookmarks: BookmarksService;
  };
}

const BookmarkUrlParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
  },
  required: ["id"],
} as const;

export const BookmarksRouter: FastifyPluginAsync<
  IBookmarksRouterOptions
> = async (server, options) => {
  const { bookmarks } = options.services;

  server.get<{
    Querystring: FromSchema<typeof NewBookmarkQuerystringSchema>;
  }>(
    "/new",
    {
      schema: {
        querystring: NewBookmarkQuerystringSchema,
      },
      attachValidation: true,
      preHandler: RequirePasswordAuth,
    },
    async (request, reply) => {
      const viewerId = request.user?.id;
      if (!viewerId) throw Boom.forbidden(`cannot create bookmark`);

      return reply.renderTemplate(templateBookmarksNew, {
        csrfToken: reply.generateCsrf(),
        formData: request.query,
      });
    }
  );

  server.post<{ Body: FromSchema<typeof NewBookmarkSchema> }>(
    "/new",
    {
      schema: {
        body: NewBookmarkSchema,
      },
      attachValidation: true,
      preValidation: server.csrfProtection,
      preHandler: RequirePasswordAuth,
    },
    async (request, reply) => {
      const viewerId = request.user?.id;
      if (!viewerId) throw Boom.forbidden(`cannot create bookmark`);

      let validationError = request.validationError as FormValidationError;
      let formData = request.body;
      const { href } = formData;

      if (href && !validator.isURL(href)) {
        validationError = addValidationError(validationError, {
          instancePath: "/href",
          message: "Invalid URL",
        });
      }

      if (validationError) {
        return reply.renderTemplate(templateBookmarksNew, {
          csrfToken: reply.generateCsrf(),
          formData,
          validationError,
        });
      }

      const newBookmark: BookmarkCreatable = {
        ownerId: request.user!.id!,
        href: formData.href!,
        title: formData.title!,
        extended: formData.extended,
        tags: bookmarks.formFieldToTags(formData.tags),
      };
      const result = await bookmarks.upsert(newBookmark);
      reply.redirect(`/bookmarks/${result.id}`);
    }
  );

  server.get<{
    Params: FromSchema<typeof BookmarkUrlParamsSchema>;
  }>(
    "/bookmarks/:id/edit",
    {
      schema: {
        params: BookmarkUrlParamsSchema,
      },
      attachValidation: true,
      preHandler: RequirePasswordAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const viewerId = request.user?.id;

      const bookmark = await bookmarks.get(viewerId, id);
      if (!bookmark) throw Boom.notFound(`bookmark ${id} not found`);
      if (!bookmark.canEdit) throw Boom.forbidden(`cannot edit bookmark ${id}`);

      const formData = {
        ...bookmark,
        tags: bookmarks.tagsToFormField(bookmark.tags),
      };

      return reply.renderTemplate(templateBookmarksEdit, {
        csrfToken: reply.generateCsrf(),
        formData,
      });
    }
  );

  server.post<{
    Params: FromSchema<typeof BookmarkUrlParamsSchema>;
    Body: FromSchema<typeof NewBookmarkSchema>;
  }>(
    "/bookmarks/:id/edit",
    {
      schema: {
        body: NewBookmarkSchema,
      },
      attachValidation: true,
      preValidation: server.csrfProtection,
      preHandler: RequirePasswordAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const viewerId = request.user?.id;

      const bookmark = await bookmarks.get(viewerId, id);
      if (!bookmark) throw Boom.notFound(`bookmark ${id} not found`);
      if (!bookmark.canEdit) throw Boom.forbidden(`cannot edit bookmark ${id}`);

      const { href, title, extended, visibility } = request.body;
      const tags = bookmarks.formFieldToTags(request.body.tags);

      const updateData = {
        href,
        title,
        extended,
        tags,
      };

      const result = await bookmarks.update(bookmark.id, updateData);
      reply.redirect(`/bookmarks/${result.id}`);
    }
  );

  server.get<{
    Params: FromSchema<typeof BookmarkUrlParamsSchema>;
  }>("/bookmarks/:id", async (request, reply) => {
    const { id } = request.params;
    const viewerId = request.user?.id;

    const bookmark = await bookmarks.get(viewerId, id);
    if (!bookmark) throw Boom.notFound(`bookmark ${id} not found`);

    return reply.renderTemplate(templateBookmarksView, {
      bookmark,
    });
  });

  server.get<{
    Params: FromSchema<typeof BookmarkUrlParamsSchema>;
  }>(
    "/bookmarks/:id/delete",
    {
      attachValidation: true,
      preHandler: RequirePasswordAuth,
    },
    async (request, reply) => {
      const { id } = request.params;
      const viewerId = request.user?.id;

      const bookmark = await bookmarks.get(viewerId, id);
      if (!bookmark) throw Boom.notFound(`bookmark ${id} not found`);
      if (!bookmark.canEdit) throw Boom.forbidden(`cannot delete bookmark ${id}`);

      return reply.renderTemplate(templateBookmarksDelete, {
        csrfToken: reply.generateCsrf(),
        bookmark,
      });
    }
  );

  server.delete<{
    Params: FromSchema<typeof BookmarkUrlParamsSchema>;
  }>(
    "/bookmarks/:id/delete",
    {
      attachValidation: true,
      preValidation: server.csrfProtection,
      preHandler: RequirePasswordAuth,
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params;
      const viewerId = request.user?.id;

      const bookmark = await bookmarks.get(viewerId, id);
      if (!bookmark) throw Boom.notFound(`bookmark ${id} not found`);
      if (!bookmark.canEdit) throw Boom.forbidden(`cannot delete bookmark ${id}`);

      const result = await bookmarks.delete(id);
      if (result) {
        return reply.redirect(`/u/${user.username}`);
      }

      return reply.code(200).send("DELETE FAILED");
    }
  );
};
