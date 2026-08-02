"""job_api.py — async Point2IFC-Job-Service (Punktwolke -> reduziertes IFC).

Point2IFC ist schwer (open3d) und langsam (Minuten/Scan), daher KEIN synchroner Request,
sondern ein Hintergrund-Job (ein Worker, Jobs serialisiert -> kein OOM).

  POST /point2ifc      {"input": "<lokaler Pfad ODER http(s)-URL zu .laz/.las/.ply/.pcd>"}
                       -> {"job_id", "status":"queued"}
  GET  /point2ifc/<id> -> {"status": queued|running|done|error, "result"|"error"}
  GET  /point2ifc/<id>/ifc  -> das reduzierte IFC (application/octet-stream)
  GET  /health         -> {"status":"ok"}

Integration m-hub: node-red laedt die Punktwolke (SeaweedFS/Upload) und POSTet deren
Pfad/URL hierher; pollt /point2ifc/<id>; bietet /ifc als Download an.
Start:  cd point2ifc && python job_api.py   (0.0.0.0:8972)
"""
import json
import os
import queue
import threading
import traceback
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from main import build_ifc

WORK = os.environ.get("POINT2IFC_WORK", "/data/point2ifc")
os.makedirs(WORK, exist_ok=True)

JOBS: dict[str, dict] = {}
Q: "queue.Queue[str]" = queue.Queue()


def _worker():
    while True:
        jid = Q.get()
        job = JOBS[jid]
        try:
            job["status"] = "running"
            src = job["input"]
            if src.startswith(("http://", "https://")):
                ext = os.path.splitext(src.split("?")[0])[1] or ".laz"
                local = os.path.join(WORK, jid, f"input{ext}")
                os.makedirs(os.path.dirname(local), exist_ok=True)
                urllib.request.urlretrieve(src, local)
                src = local
            if not os.path.isfile(src):
                raise FileNotFoundError(f"input not found: {src}")
            job["result"] = build_ifc(src, out_dir=os.path.join(WORK, jid, "out"),
                                      write_floors=False)
            job["status"] = "done"
        except Exception as e:
            job["error"] = f"{e}\n{traceback.format_exc()}"
            job["status"] = "error"
        finally:
            Q.task_done()


threading.Thread(target=_worker, daemon=True).start()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.rstrip("/") != "/point2ifc":
            return self._send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            data = json.loads(self.rfile.read(n) or b"{}")
            src = (data.get("input") or "").strip()
            if not src:
                return self._send(400, {"error": "missing 'input' (path or url)"})
            jid = uuid.uuid4().hex[:12]
            JOBS[jid] = {"status": "queued", "input": src, "result": None, "error": None}
            Q.put(jid)
            self._send(202, {"job_id": jid, "status": "queued"})
        except Exception as e:
            self._send(400, {"error": str(e)})

    def do_GET(self):
        parts = self.path.strip("/").split("/")
        if parts == ["health"]:
            return self._send(200, {"status": "ok", "jobs": len(JOBS)})
        if parts and parts[0] == "point2ifc" and len(parts) >= 2:
            job = JOBS.get(parts[1])
            if not job:
                return self._send(404, {"error": "unknown job_id"})
            if len(parts) == 2:
                return self._send(200, {"status": job["status"],
                                        "result": job["result"], "error": job["error"]})
            if len(parts) == 3 and parts[2] == "ifc":
                if job["status"] != "done":
                    return self._send(409, {"error": f"job not done ({job['status']})"})
                path = job["result"]["ifc"]
                data = open(path, "rb").read()
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition",
                                 f'attachment; filename="{os.path.basename(path)}"')
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
        self._send(404, {"error": "not found"})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    host = os.environ.get("POINT2IFC_HOST", "0.0.0.0")
    port = int(os.environ.get("POINT2IFC_PORT", "8972"))
    print(f"point2ifc job-service on {host}:{port}  (POST /point2ifc, GET /point2ifc/<id>[/ifc], /health)")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
