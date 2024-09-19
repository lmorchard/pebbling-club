import { FastifyPluginAsync } from "fastify";
import templateHome from "./templates/home";
import { render } from "./utils/html";
import { IBaseRouterOptions } from "./types";

export interface IHomeRouterOptions extends IBaseRouterOptions {}

export const HomeRouter: FastifyPluginAsync<IHomeRouterOptions> = async (
  fastify,
  options
) => {
  fastify.get("/", async (request, reply) => {
    return reply.renderTemplate(templateHome);
  });
};
