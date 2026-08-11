#!/usr/bin/env python3
"""m-hub Teststrecke — faehrt alle E2E-Suiten gegen den LAUFENDEN Stack und meldet PASS/FAIL.

Deckt den kompletten Download-1-Pfad ab: Upload (idempotenter reserve/Resume) ->
Point2IFC-Job (durabler Status) -> reduziertes IFC als eigenes Dokument.

  Lokal (Default):        python3 run_teststrecke.py
  Mit Punktwolke*:        P2I_PC_FILE=/pfad/zu/scan.pcd python3 run_teststrecke.py
  Gegen prod:             P2I_NODE=https://m-hub.dap.tuwien.ac.at P2I_DB_CONT=m-hub-m-hub-db-1 \\
                          P2I_PC_FILE=/root/scan.pcd python3 run_teststrecke.py

* Ohne P2I_PC_FILE laufen nur die Upload-/reserve-Tests; die Verarbeitungs-Suiten
  (Point2IFC-Job, IFC-Dokument) werden sauber uebersprungen (brauchen eine echte Punktwolke).
"""
import sys

from harness import Results
import test_upload_resume
import test_point2ifc_job
import test_ifc_document
import test_plausibility

SUITES = (test_upload_resume, test_point2ifc_job, test_ifc_document, test_plausibility)


def main():
    r = Results()
    print("=== m-hub Teststrecke: Download-1 (Upload -> reduziertes IFC) ===\n", flush=True)
    for mod in SUITES:
        print("--- " + mod.__name__ + " ---", flush=True)
        try:
            mod.run(r)
        except Exception as e:  # eine Suite darf die anderen nicht mitreissen
            r.check(mod.__name__ + ": Suite lief durch", False, repr(e))
        print("", flush=True)
    print(f"=== GESAMT: {r.passed()}/{r.total()} PASS ===", flush=True)
    return 0 if r.total() > 0 and r.passed() == r.total() else 1


if __name__ == "__main__":
    sys.exit(main())
