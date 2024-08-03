import { FastifyPluginAsync } from "fastify";
import templateHome from "../templates";
import { render } from "../utils/html";
import { IBaseRouterOptions } from "./types";

export interface IRouterOptions extends IBaseRouterOptions {}

const Router: FastifyPluginAsync<IRouterOptions> = async (
  fastify,
  options
) => {
  fastify.get("/", async (request, reply) => {
    return reply.renderTemplate(templateHome);
  });
};

export default Router;
