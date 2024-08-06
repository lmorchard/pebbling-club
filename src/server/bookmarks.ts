import { FastifyPluginAsync } from "fastify";
import { IBaseRouterOptions } from "./types";
import templateBookmarksNew from "./templates/bookmarks/new";
import { FromSchema } from "json-schema-to-ts";
import { addValidationError, FormValidationError } from "./utils/forms";
import validator from "validator";
import { RequirePasswordAuth } from "./auth";

export interface IBookmarksRouterOptions extends IBaseRouterOptions {}

export const BookmarksRouter: FastifyPluginAsync<
  IBookmarksRouterOptions
> = async (fastify, options) => {
  const newBookmarkQuerystringSchema = {
    type: "object",
    properties: {
      href: {
        type: "string",
      },
      title: {
        type: "string",
      },
      extended: {
        type: "string",
      },
      tags: {
        type: "string",
      },
    },
  } as const;

  fastify.get<{
    Querystring: FromSchema<typeof newBookmarkQuerystringSchema>;
  }>(
    "/new",
    {
      schema: {
        querystring: newBookmarkQuerystringSchema,
      },
      attachValidation: true,
      preHandler: RequirePasswordAuth,
    },
    async (request, reply) => {
      const csrfToken = await reply.generateCsrf();
      return reply.renderTemplate(templateBookmarksNew, {
        csrfToken,
        formData: request.query,
      });
    }
  );

  const newBookmarkSchema = {
    type: "object",
    properties: {
      href: {
        type: "string",
        minLength: 1,
        errorMessage: {
          type: "URL required",
          minLength: "URL required",
        },
      },
      title: {
        type: "string",
        minLength: 1,
        errorMessage: {
          type: "Title required",
          minLength: "Title required",
        },
      },
      extended: {
        type: "string",
      },
      tags: {
        type: "string",
      },
      visibility: {
        type: "string",
        enum: ["public", "private"],
        errorMessage: {
          enum: "Invalid visibility",
        },
      },
    },
  } as const;

  fastify.post<{ Body: FromSchema<typeof newBookmarkSchema> }>(
    "/new",
    {
      schema: {
        body: newBookmarkSchema,
      },
      attachValidation: true,
      preValidation: fastify.csrfProtection,
      preHandler: RequirePasswordAuth,
    },
    async (request, reply) => {
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
        const csrfToken = await reply.generateCsrf();
        return reply.renderTemplate(templateBookmarksNew, {
          csrfToken,
          formData,
          validationError,
        });
      }

      reply.send(`OK ${JSON.stringify(formData, null, "  ")}`).status(200);
      //reply.redirect(`/bookmarks/${result.id}`);
    }
  );
};
