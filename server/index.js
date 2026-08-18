import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import { verifyPassword, verifyTotp, issueToken } from "./auth.js";
import securityMasterRoutes from "./routes/securityMaster.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Render läuft hinter einem Reverse-Proxy -> nötig für korrektes
// Rate-Limiting und sichere Cookies
app.set("trust proxy", 1);

// Frontend und Backend laufen jetzt auf derselben Domain -> kein CORS/
// Cross-Site-Cookie-Problem mehr (wichtig für Safari, das Cross-Site-
// Cookies standardmäßig blockiert).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));

// Brute-Force-Schutz auf Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Min
  max: 5, // max 5 Versuche
  message: { error: "Zu viele Login-Versuche. Bitte später erneut versuchen." },
});

// Schritt 1: Username + Passwort
// Gibt bei Erfolg ein temporäres Ticket zurück, NOCH KEINE Session
app.post("/api/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = await verifyPassword(username, password);
  if (!user) return res.status(401).json({ error: "Ungültige Zugangsdaten" });

  // Kurzlebiges Zwischen-Token, das nur zur 2FA-Bestätigung berechtigt
  res.json({ userId: user.id, requiresTotp: true });
});

// Schritt 2: TOTP-Code prüfen -> erst danach echte Session (Cookie) setzen
app.post("/api/verify-2fa", loginLimiter, async (req, res) => {
  const { userId, token } = req.body;
  const { query } = await import("./db.js");
  const result = await query(
    "SELECT id, username, totp_secret FROM admin_users WHERE id=$1",
    [userId]
  );
  if (result.rows.length === 0) return res.status(401).json({ error: "Ungültig" });

  const user = result.rows[0];
  const valid = verifyTotp(user.totp_secret, token);
  if (!valid) return res.status(401).json({ error: "2FA-Code falsch" });

  const jwtToken = issueToken(user.id, user.username);
  res.cookie("session", jwtToken, {
    httpOnly: true,
    secure: true, // nur über HTTPS (Render erzwingt das automatisch)
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
  });
  res.json({ success: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("session");
  res.json({ success: true });
});

app.use("/api/security-master", securityMasterRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API läuft auf Port ${PORT}`));
