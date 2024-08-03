import { render, TemplateContent } from "./html";
import { LayoutProps } from "../templates/layout";
import fp from "fastify-plugin";

export interface ITemplateProps extends Record<string, any> {}

export type RenderableTemplate<P extends ITemplateProps> = (
  props: P
) => TemplateContent;

declare module "fastify" {
  interface FastifyReply {
    renderTemplate: <P extends ITemplateProps, T extends RenderableTemplate<P>>(
      template: T,
      props?: P
    ) => void;
  }
}

export const TemplateRenderer = fp(async (fastify, options) => {
  fastify.decorateReply("renderTemplate", function (template, props = {}) {
    const reply = this;
    const request = this.request;
    const layoutProps: LayoutProps = {
      user: request.user,
      csrfToken: reply.generateCsrf(),
    };
    return reply
      .code(200)
      .headers({
        "Content-Type": "text/html",
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
  });
});
