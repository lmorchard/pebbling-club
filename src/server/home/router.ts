import { Server } from "../index";
import { Router, Express } from "express";
import templateHome from "../templates";
import { renderWithLocals } from "../utils/templates";

export default function init(server: Server, app: Express) {
  const router = Router();
  
  router.get("/", renderWithLocals(templateHome));

  return router;
}
