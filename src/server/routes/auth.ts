import { Router } from "express";

export default function init() {
  const router = Router();
  
  router.get('/', (req, res) => {
    res.send('Hello AUTH!')
  });

  return router;
}
