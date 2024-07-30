import { RequestHandler } from "express";
import { render, RenderableTemplate, TemplateContent } from "../../utils/html";

export const renderWithLocals =
  (template: (props: Express.Locals) => TemplateContent): RequestHandler =>
  (req, res, next) => {
    res.send(render(template(res.locals)));
  };
