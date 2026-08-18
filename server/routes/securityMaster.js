import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Alle Routen hier erfordern gültige Session
router.use(requireAuth);

// Liste abrufen
router.get("/", async (req, res) => {
  const result = await query(
    "SELECT * FROM security_master ORDER BY id DESC LIMIT 500"
  );
  res.json(result.rows);
});

// Neuen Eintrag anlegen
router.post("/", async (req, res) => {
  const { isin, name, asset_class, currency, exchange } = req.body;
  if (!name) return res.status(400).json({ error: "name ist erforderlich" });

  const result = await query(
    `INSERT INTO security_master (isin, name, asset_class, currency, exchange)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [isin, name, asset_class, currency, exchange]
  );
  res.status(201).json(result.rows[0]);
});

// Eintrag bearbeiten
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { isin, name, asset_class, currency, exchange } = req.body;

  const result = await query(
    `UPDATE security_master
     SET isin=$1, name=$2, asset_class=$3, currency=$4, exchange=$5, updated_at=now()
     WHERE id=$6 RETURNING *`,
    [isin, name, asset_class, currency, exchange, id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(result.rows[0]);
});

// Eintrag löschen
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const result = await query("DELETE FROM security_master WHERE id=$1 RETURNING id", [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Nicht gefunden" });
  res.json({ deleted: id });
});

export default router;
