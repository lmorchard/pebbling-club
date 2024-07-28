import { Router } from "express";
import * as templates from "../templates";

export default function init() {
  const router = Router();
  
  router.get('/', (req, res) => {
    const { globalProps } = res.locals;
    res.send(templates.index({ ...globalProps })());
  });

  return router;
}
