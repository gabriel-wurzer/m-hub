# Schemaaenderungen auf prod

Postgres fuehrt `init/*.sql` **nur einmal aus, auf einem leeren Volume**. prod behaelt
sein `pgdata` ueber jeden Deploy. Jede Schemaaenderung, die nach dem ersten Hochziehen
committet wird, erreicht die laufende Datenbank also **nicht von selbst**.

**Entscheidung vom 12.08.2026:** bis Projektende kein Migrationsrunner. Es bleibt bei
Handarbeit, aber protokolliert und geprueft. Ein Migrationsframework, das danach niemand
mehr wartet, waere teurer als der Nutzen auf acht Wochen.

## Regeln

1. Eine Schemaaenderung besteht aus **zwei** Schritten: `init/*.sql` aendern **und**
   dieselbe DDL von Hand auf prod anwenden. Nie nur eines von beidem.
2. Jeden Handeingriff unten eintragen: Datum, wer, das SQL im Wortlaut, der Grund.
3. Vor Vorfuehrungen und nach jedem Deploy pruefen:

   ```bash
   ./deploy/schema-check.sh prod     # oder ohne Argument gegen den lokalen Stack
   ```

   Das Skript zieht ein frisches Postgres aus diesem `init`-Ordner hoch und vergleicht
   Spalten, Indizes und Constraints gegen das Ziel. Nur lesend. Exit 0 = kein Drift.

4. `init/*.sql` ist **nicht** wiederholbar (z.B. ungeschuetztes
   `ALTER TABLE ... ADD CONSTRAINT` in `04_building_objects.sql`). Diese Dateien
   niemals gegen eine bestehende Datenbank laufen lassen.

## Stand

**12.08.2026, geprueft mit `deploy/schema-check.sh prod`: kein Drift.**
Spalten 123 zu 123, Indizes und Constraints 90 zu 90.

## Protokoll

Aeltere Eintraege sind rekonstruiert, das Protokoll gibt es erst seit dem 12.08.2026.
Sie sind hier festgehalten, damit die Herkunft der Abweichungen nachvollziehbar bleibt.

| Datum | Wer | Aenderung | Anmerkung |
|---|---|---|---|
| 2026-07-03 | Gabriel | `market_listings.location` auf nullable | Von Hand auf prod, Backup unter `/root/market_listings-backup-*.sql` |
| Juli 2026 | vermutlich Lukas | Tabelle `building_object_images` angelegt | Fehlte am 06.07. auf prod (Bilderfunktion kaputt), ist seither vorhanden; genauer Zeitpunkt nicht protokolliert |
| Juli 2026 | vermutlich Lukas | Spalte `market_listings.address` | Fehlte am 06.07. auf prod (Abfrage aehnlicher Inserate kaputt), ist seither vorhanden |
| August 2026 | Gabriel | `documents.p2i_*`, `file_original_name`, `file_size`, Index `uq_documents_open_reservation`, Teilindex `idx_documents_p2i_active` | Aus den Commits e69bbfa und f519edd; auf prod vorhanden, der Weg dorthin ist nicht protokolliert |

<!-- Neue Eintraege oben anfuegen, mit dem SQL im Wortlaut. -->
