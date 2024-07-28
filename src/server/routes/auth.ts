import crypto from "crypto";
import { Router } from "express";
import passport from "passport";
import LocalStrategy from 'passport-local';

export default function init() {
  const router = Router();
  
  router.get('/', (req, res) => {
    res.send('Hello AUTH!')
  });

  return router;
}
