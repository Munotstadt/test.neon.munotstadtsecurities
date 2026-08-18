# Security Master Admin – Setup

## Architektur
Browser (index.html) → Backend-API (Render, Node/Express) → Neon Postgres

Die index.html spricht NIEMALS direkt mit Neon. Alle DB-Zugriffe laufen
über die Backend-API, die den Connection-String nur serverseitig kennt.

## 1. Neon-Datenbank vorbereiten
1. Öffne den Neon SQL Editor für deine Datenbank.
2. Führe `server/migrations.sql` aus (legt `admin_users` und ggf.
   `security_master` an, falls noch nicht vorhanden).
3. Lege deinen ersten Admin-Nutzer an (siehe Schritt 2 für Passwort-Hash
   und TOTP-Secret-Erzeugung).

## 2. Admin-Nutzer + 2FA-Secret erzeugen

Lokal (einmalig), z.B. in Node-REPL:

```js
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";

const hash = await bcrypt.hash("DEIN-STARKES-PASSWORT", 12);
const secret = speakeasy.generateSecret({ name: "SecurityMaster Admin" });

console.log("password_hash:", hash);
console.log("totp_secret (base32):", secret.base32);
console.log("otpauth_url (als QR-Code scannen):", secret.otpauth_url);
```

Den `otpauth_url` als QR-Code rendern (z.B. auf qr-code-generator.com einfügen)
und mit Google Authenticator / Authy scannen.

Dann in Neon:

```sql
INSERT INTO admin_users (username, password_hash, totp_secret)
VALUES ('dein-username', '<password_hash>', '<totp_secret>');
```

## 3. GitHub Repo
1. Dieses Projekt in ein neues GitHub-Repo pushen.
2. Render mit GitHub verbinden (nur dieses Repo autorisieren).

## 4. Render Deployment
1. In Render: "New" → "Blueprint" → Repo auswählen.
   Render erkennt automatisch die `render.yaml`.
2. Environment Variables setzen:
   - `DATABASE_URL`: dein Neon Connection String (Format:
     `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`)
   - `ALLOWED_ORIGIN`: die URL deines Frontend-Services (z.B.
     `https://security-master-frontend.onrender.com`)
3. `JWT_SECRET` wird automatisch generiert (durch `generateValue: true`).

## 5. Frontend-URL im Code eintragen
In `public/index.html` die Zeile

```js
const API_BASE = "https://DEIN-BACKEND.onrender.com/api";
```

auf deine tatsächliche Backend-Service-URL anpassen (nach dem ersten
Deploy sichtbar im Render-Dashboard), dann erneut pushen.

## 6. Login-Flow testen
1. Frontend-URL öffnen (deine "test.security"-Domain).
2. Benutzername + Passwort eingeben.
3. 6-stelligen Code aus der Authenticator-App eingeben.
4. Bei Erfolg: Session-Cookie (15 Min gültig, httpOnly, secure) wird gesetzt.

## Sicherheits-Hinweise
- Custom Domain (`test.security...`) in Render unter "Settings → Custom Domain"
  einrichten; Render stellt automatisch ein TLS-Zertifikat aus.
- `JWT_SECRET` niemals im Code oder Git committen.
- Erwäge, IP-Whitelisting oder Render's eigene Access-Control-Optionen
  zusätzlich zu aktivieren, wenn nur du selbst zugreifst.
- Regelmäßig `npm audit` laufen lassen bzw. Dependabot in GitHub aktivieren.
