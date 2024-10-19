import { IBaseRouterOptions } from "./types";
import Boom from "@hapi/boom";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { FeedsService } from "../services/feeds";
import { FromSchema } from "json-schema-to-ts";

export interface IFeedsRouterOptions extends IBaseRouterOptions {
  services: {
    feeds: FeedsService;
  };
}

export const FeedsRouter: FastifyPluginAsync<IFeedsRouterOptions> = async (
  server,
  options
) => {
  const {
    services: { feeds },
  } = options;

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.isAuthenticated()) {
      throw Boom.forbidden("feed access requires authentication");
    }
  };

  const FeedsGetBatchQuerystringSchema = {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: { type: "string" },
      },
      since: { type: "string" },
    },
    required: ["urls"],
  } as const;

  server.get<{
    Querystring: FromSchema<typeof FeedsGetBatchQuerystringSchema>;
  }>(
    "/get",
    {
      schema: {
        querystring: FeedsGetBatchQuerystringSchema,
      },
    },
    async (request, reply) => {
      const { urls, since } = request.query;
      const results = await fetchFeedsBatch({ urls, since });
      return reply.status(200).send(results);
    }
  );

  const FeedsPostBatchBodySchema = {
    ...FeedsGetBatchQuerystringSchema,
    properties: {
      ...FeedsGetBatchQuerystringSchema.properties,
      update: { type: "boolean" },
    }
  } as const;

  server.post<{
    Body: FromSchema<typeof FeedsPostBatchBodySchema>;
  }>(
    "/get",
    {
      schema: { body: FeedsPostBatchBodySchema },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { urls, since, update } = request.body;
      const results = await fetchFeedsBatch({ urls, since, update });
      return reply.status(200).send(results);
    }
  );

  async function fetchFeedsBatch({
    urls,
    update,
    since,
  }: {
    urls: string[];
    since?: string;
    update?: boolean;
  }) {
    return await Promise.all(
      urls.map(async (url) => {
        try {
          if (update) await feeds.update({ url });
          const fetched = await feeds.get(url, { since });
          return { url, success: true, fetched };
        } catch (err: any) {
          return { url, success: false, err };
        }
      })
    );
  }

  const FeedsDiscoverQuerystringSchema = {
    type: "object",
    properties: {
      url: { type: "string" },
    },
    required: ["url"],
  } as const;

  server.get<{
    Querystring: FromSchema<typeof FeedsDiscoverQuerystringSchema>;
  }>(
    "/discover",
    {
      schema: {
        querystring: FeedsDiscoverQuerystringSchema,
      },
    },
    async (request, reply) => {
      const { url } = request.query;
      // TODO: accept options in query params
      try {
        const result = await feeds.autodiscover(url);
        return reply.status(200).send(result);
      } catch (err: any) {
        if ("code" in err) {
          if (err.code === "ENOTFOUND") {
            return reply.status(404).send("feed not found");
          }
        }
        reply.log.error({ msg: "discover failed", err });
        return reply.status(500).send({ msg: "discover failed", err });
      }
    }
  );

  const DiscoverBatchSchema = {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: {type: "string" },
      },
    },
    required: ["urls"],
  } as const;

  server.post<{
    Body: FromSchema<typeof DiscoverBatchSchema>;
  }>(
    "/discover",
    {
      schema: {
        body: DiscoverBatchSchema,
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { urls } = request.body;

      const results = await Promise.all(
        urls.map(async (url) => {
          try {
            const discovered = await feeds.autodiscover(url);
            return { url, success: true, discovered };
          } catch (err: any) {
            return { url, success: false, err };
          }
        })
      );

      return reply.status(200).send(results);
    }
  );
};
