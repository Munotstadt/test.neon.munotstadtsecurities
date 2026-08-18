import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import { query } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET; // 32+ zufällige Zeichen, in Render env setzen
const JWT_EXPIRY = "15m"; // kurze Lebensdauer für Finanzdaten-Zugriff

// Schritt 1: Passwort prüfen
export async function verifyPassword(username, password) {
  const result = await query(
    "SELECT id, password_hash, totp_secret FROM admin_users WHERE username = $1",
    [username]
  );
  if (result.rows.length === 0) return null;

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  return user; // enthält totp_secret für Schritt 2
}

// Schritt 2: TOTP-Code prüfen (aus Google Authenticator / Authy etc.)
export function verifyTotp(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1, // erlaubt 30s Zeitabweichung
  });
}

// Schritt 3: JWT ausstellen nach erfolgreichem Login + 2FA
export function issueToken(userId, username) {
  return jwt.sign({ sub: userId, username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
