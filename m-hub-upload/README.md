# m-hub-upload

Resumable big-file upload service (tus) for m-hub. Streams large files
(point clouds, IFC, big PDFs) straight to SeaweedFS, bypassing node-red and the
base64 path. See `docs/big-file-upload.md` for the concept.

## Flow

1. m-hub reserves a document (`POST /api/documents/reserve`) and hands the
   tool/browser a short-lived **upload JWT** (`scope: "upload"`) carrying
   `document_id`, `user_building_id`, `filename`, `filetype`.
2. Browser uploads resumably (tus) to `/upload` with that JWT. The token is
   verified on every request; a general session token is rejected (wrong scope).
3. On completion the service PUTs the assembled file to the filer at
   `/mhub/documents/<user_building_id>/<document_id>/<filename>` — the path comes
   from the **signed token**, not client metadata, so a token for document A
   cannot write into document B's path. It returns the path in `X-Stored-Path`.
4. The browser calls `POST /api/documents/:id/attach` to record it
   (`documents.file_url`) after the service confirms the file is stored.

Bytes never touch node-red; the whole file is streamed and chunked. Auth is the
same m-hub JWT secret (HS256). Verified locally: resumable 2-chunk upload +
HEAD-resume + filer store.

## Run

```bash
npm install
npm run dev            # tsx watch, :3300
# or
npm run build && npm start
```

Dev without a secret runs with **auth disabled** (logs `auth=OFF (dev)`). Set
`JWT_SECRET` for real auth.

## Deploy (next stage, with Lukas)

### docker-compose (add to the m-hub stack, same network as seaweed-filer)

```yaml
  m-hub-upload:
    build: ./m-hub-upload
    environment:
      SEAWEED_FILER_INTERNAL_URL: http://seaweed-filer:8888
      JWT_SECRET: ${MHUB_JWT_SECRET}
      UPLOAD_DIR: /data/tus
    volumes:
      - upload-tmp:/data/tus
    # not published to the host; reached only via the frontend nginx /upload/
# volumes: upload-tmp:
```

### nginx (frontend container `nginx.conf`) — stream, don't buffer

```nginx
location /upload/ {
    proxy_pass http://m-hub-upload:3300/upload/;
    proxy_http_version 1.1;
    proxy_request_buffering off;
    client_max_body_size 0;        # own cap, general 50m stays elsewhere
    proxy_read_timeout 3600s;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
}
```

Host nginx needs the same `/upload/` location (own high cap +
`proxy_request_buffering off`) so big bodies pass the entry. Restrict `/files/`
to `GET`/`HEAD` (writes go only through this authenticated path).

### node-red (Lukas)

- `POST /api/documents` metadata-only (returns id + issues the upload JWT).
- Internal endpoint to set `documents.file_url` after upload (HEAD-verify).
