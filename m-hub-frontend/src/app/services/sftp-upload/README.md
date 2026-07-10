# SFTP upload API contract

The browser does not establish the SFTP connection itself. It requests a
temporary, narrowly scoped SFTP account. A later frontend step can pass the
connection details to an installed SFTP client. The user selects the actual file
inside that client because browsers cannot preselect local files in external
applications.

## Create temporary access

`POST /api/sftp-upload-sessions`

The request is defined by `CreateSftpUploadSessionRequest` and is only used
while creating a new document. It contains the document context, but no local
file. The frontend does not offer SFTP access while editing an existing
document. The response is JSON:

```json
{
  "sessionId": "7c882f9c-5374-40e9-94dd-d7f0935314a5",
  "status": "ready",
  "host": "sftp.example.org",
  "port": 22,
  "username": "mhub_upload_7c882f9c",
  "password": "one-time-password",
  "targetPath": "/incoming/7c882f9c/",
  "expiresAt": "2026-07-10T12:30:00Z"
}
```

The account must be restricted to its target directory, have no shell access,
expire automatically and permit only the expected upload size. Credentials
must never be written to application logs.

## Check transfer

`GET /api/sftp-upload-sessions/{sessionId}`

Possible states are `ready`, `waiting`, `uploaded`, `verified`, `expired` and
`failed`. Only `verified` may be attached to a document. Verification should
compare the expected filename and size and should include malware scanning if
untrusted users can upload files.

The document create endpoint receives the verified `upload_session_id`. It must
confirm ownership and atomically claim the upload. Updating an existing
document does not accept SFTP upload sessions in the current flow.

## Abort

`DELETE /api/sftp-upload-sessions/{sessionId}`

This revokes the temporary account and removes unfinished upload data. A server
job must also revoke expired sessions and clean abandoned files.

## Current frontend state

`LargeFileUploadComponent.backendEnabled` currently defaults to `false`. The
request button therefore only shows a short progress indicator followed by an
implementation notice. Set it to `true` after the session endpoint is deployed.
The component already expects the JSON response above. Opening an external SFTP
client is intentionally a separate, not yet implemented step.
