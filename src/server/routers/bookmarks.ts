import { FastifyPluginAsync } from "fastify";
import { IBaseRouterOptions } from "./types";
import templateBookmarksNew from "../templates/bookmarks/new";
import { FromSchema } from "json-schema-to-ts";
import { addValidationError, FormValidationError } from "../utils/forms";
import validator from "validator";

export interface IRouterOptions extends IBaseRouterOptions {}

const Router: FastifyPluginAsync<IRouterOptions> = async (fastify, options) => {
  const { server } = options;
  const { log, app } = server;
  const { services } = app;
  const { bookmarks, profiles } = services;

  fastify.addHook("preHandler", async (request, reply) => {
    if (!request.isAuthenticated()) {
      return reply.redirect("/login");
    }
  });

  fastify.get("/new", {}, async (request, reply) => {
    return reply.renderTemplate(templateBookmarksNew);
  });

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
      /*
      visibility: {
        type: "string",
        enum: ["public", "private"],
        errorMessage: {
          enum: "Invalid visibility",
        },
      },
      */
    },
  } as const;

  fastify.post<{ Body: FromSchema<typeof newBookmarkSchema> }>(
    "/new",
    {
      attachValidation: true,
      schema: {
        body: newBookmarkSchema,
      },
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
        return reply.renderTemplate(templateBookmarksNew, {
          formData,
          validationError,
        });
      }

      reply.send(`OK ${JSON.stringify(formData, null, "  ")}`).status(200);
      //reply.redirect(`/bookmarks/${result.id}`);
    }
  );
};

export default Router;
