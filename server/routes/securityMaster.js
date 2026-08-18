import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Alle Routen hier erfordern gültige Session
router.use(requireAuth);

// Liste abrufen
router.get("/", async (req, res) => {
  try {
    const result = await query(
      `SELECT security_id, security_name, ticker, isin, valor, currency,
              collector, dashboard_grouping, instrument, portfolio_grouping,
              date_launch, date_terminated, status, comments
       FROM security_master
       ORDER BY security_id DESC LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Abrufen der Daten" });
  }
});

// Neuen Eintrag anlegen
router.post("/", async (req, res) => {
  const {
    security_name, ticker, isin, valor, currency,
    collector, dashboard_grouping, instrument, portfolio_grouping,
    date_launch, date_terminated, status, comments,
  } = req.body;

  if (!security_name) return res.status(400).json({ error: "security_name ist erforderlich" });

  try {
    const result = await query(
      `INSERT INTO security_master
        (security_name, ticker, isin, valor, currency,
         collector, dashboard_grouping, instrument, portfolio_grouping,
         date_launch, date_terminated, status, comments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [security_name, ticker || null, isin || null, valor || null, currency || null,
       collector || null, dashboard_grouping || null, instrument || null, portfolio_grouping || null,
       date_launch || null, date_terminated || null, status || null, comments || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Speichern: " + err.message });
  }
});

// Eintrag bearbeiten
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    security_name, ticker, isin, valor, currency,
    collector, dashboard_grouping, instrument, portfolio_grouping,
    date_launch, date_terminated, status, comments,
  } = req.body;

  try {
    const result = await query(
      `UPDATE security_master SET
        security_name=$1, ticker=$2, isin=$3, valor=$4, currency=$5,
        collector=$6, dashboard_grouping=$7, instrument=$8, portfolio_grouping=$9,
        date_launch=$10, date_terminated=$11, status=$12, comments=$13
       WHERE security_id=$14 RETURNING *`,
      [security_name, ticker || null, isin || null, valor || null, currency || null,
       collector || null, dashboard_grouping || null, instrument || null, portfolio_grouping || null,
       date_launch || null, date_terminated || null, status || null, comments || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Nicht gefunden" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Aktualisieren: " + err.message });
  }
});

// Eintrag löschen
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      "DELETE FROM security_master WHERE security_id=$1 RETURNING security_id",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Nicht gefunden" });
    res.json({ deleted: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Löschen: " + err.message });
  }
});

export default router;
