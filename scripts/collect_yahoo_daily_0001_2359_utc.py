"""Collector_YahooDaily_0001-2359_UTC: läuft täglich (7 Tage/Woche), rund um die Uhr,
jeweils zur Minute 18/48 (siehe Workflow).
Holt Kurse für alle Securities mit Collector = 2 und Ticker IS NOT NULL aus der Tabelle
'security_master', schreibt die Kurse nach 'security_prices' in der Neon-Postgres-Datenbank
(Projekt munotstadtsecurities)."""

import os
import sys
import time
from datetime import datetime, timezone

import psycopg2
import yfinance as yf

COLLECTOR_ID = 2
SOURCE_NAME = "YahooDaily_0001-2359_UTC"
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 5


class NeonClient:
    """Dünner Wrapper um eine psycopg2-Verbindung zur Neon-Postgres-Datenbank."""

    def __init__(self, dsn):
        parsed_host = dsn.split("@")[-1].split("/")[0].split("?")[0]
        print(f"DIAGNOSE: Verbinde zu Host = {parsed_host}")
        self.conn = psycopg2.connect(dsn, connect_timeout=20)
        self.conn.autocommit = False

    def execute(self, sql, args=None):
        with self.conn.cursor() as cur:
            cur.execute(sql, args or [])
            self.conn.commit()
            if cur.description is None:
                return [], cur.rowcount
            rows = cur.fetchall()
            return rows, cur.rowcount

    def close(self):
        self.conn.close()


def get_client():
    dsn = os.environ.get("NEON_DATABASE_URL", "")
    if not dsn:
        print("FEHLER: NEON_DATABASE_URL fehlt.")
        sys.exit(1)
    return NeonClient(dsn)


def fetch_securities(client):
    rows, _ = client.execute(
        "SELECT security_id, ticker FROM security_master "
        "WHERE collector = %s AND ticker IS NOT NULL",
        [COLLECTOR_ID],
    )
    return [(row[0], row[1]) for row in rows]


def fetch_price_with_retry(ticker):
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            t = yf.Ticker(ticker)
            price = t.fast_info["last_price"]
            if price is None:
                raise ValueError("last_price ist None")
            return float(price)
        except Exception as e:
            last_error = e
            if attempt < MAX_RETRIES:
                wait = RETRY_BACKOFF_SECONDS * attempt
                print(f"  Versuch {attempt} für {ticker} fehlgeschlagen ({e}), warte {wait}s...")
                time.sleep(wait)
    raise last_error


def price_already_exists(client, security_id, price_date):
    rows, _ = client.execute(
        "SELECT 1 FROM security_prices WHERE security_id = %s AND price_date = %s "
        "AND source = %s LIMIT 1",
        [security_id, price_date, SOURCE_NAME],
    )
    return len(rows) > 0


def insert_price(client, security_id, price, price_date, created_at):
    # security_prices.id wird über die Sequence security_prices_id_seq (DEFAULT)
    # automatisch vergeben, daher hier nicht mehr manuell angegeben.
    _, affected = client.execute(
        """INSERT INTO security_prices (security_id, price, price_date, source, created_at)
           VALUES (%s, %s, %s, %s, %s)""",
        [security_id, price, price_date, SOURCE_NAME, created_at],
    )
    return affected


def main():
    client = get_client()

    securities = fetch_securities(client)
    print(f"{len(securities)} Securities mit Collector={COLLECTOR_ID} gefunden.")

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    added, skipped, errors = 0, 0, 0

    for security_id, ticker in securities:
        try:
            price = fetch_price_with_retry(ticker)
            if price_already_exists(client, security_id, now_iso):
                skipped += 1
                print(f"  SKIP   SecurityID={security_id} Ticker={ticker} Price={price}")
                continue
            insert_price(client, security_id, price, now_iso, now_iso)
            added += 1
            print(f"  OK     SecurityID={security_id} Ticker={ticker} Price={price}")
        except Exception as e:
            errors += 1
            print(f"  FEHLER SecurityID={security_id} Ticker={ticker}: {e}")

    count_after, _ = client.execute("SELECT COUNT(*) FROM security_prices")
    print(f"Fertig: {added} neu eingefügt, {skipped} übersprungen, {errors} Fehler.")
    print(f"Zeilen in security_prices insgesamt: {count_after[0][0]}")

    client.close()

    if added == 0 and errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
