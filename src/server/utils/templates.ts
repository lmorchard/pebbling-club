import { RequestHandler } from "express";
import { render, TemplateContent } from "./html";

export const renderWithLocals =
  (template: (props: Express.Locals) => TemplateContent): RequestHandler =>
  (req, res, next) => {
    res.send(render(template(res.locals)));
  };
