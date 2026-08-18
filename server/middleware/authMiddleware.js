import { verifyToken } from "../auth.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: "Nicht angemeldet" });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Session abgelaufen" });

  req.user = payload;
  next();
}
