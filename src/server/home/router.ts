import { Server } from "../index";
import { Router, Express } from "express";
import * as templates from "./templates";

export default function init(server: Server, app: Express) {
  const router = Router();
  
  router.get('/', (req, res) => {
    const { layoutProps } = res.locals;
    res.send(templates.index({ ...layoutProps })());
  });

  return router;
}
