import { render, ITemplateProps, RenderableTemplate } from "./html";
import { LayoutProps } from "../templates/layout";
import fp from "fastify-plugin";
import { IConfig } from "../../app/types";

declare module "fastify" {
  interface FastifyReply {
    renderTemplate: <P extends ITemplateProps>(
      templateFunction: RenderableTemplate<P>,
      props?: P,
      contentType?: string
    ) => void;
  }
}

export interface TemplateRendererOptions {
  config: IConfig;
}

export const TemplateRenderer = fp(
  async (fastify, { config }: TemplateRendererOptions) => {
    fastify.decorateReply(
      "renderTemplate",
      function (template, props, contentType = "text/html") {
        const reply = this;
        const request = this.request;

        const layoutProps: LayoutProps = {
          user: request.user,
          siteUrl: config.get("siteUrl"),
        };

        return reply
          .code(200)
          .headers({
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
          })
          .send(
            render(
              template({
                ...layoutProps,
                ...props,
              })
            )
          );
      }
    );
  }
);
