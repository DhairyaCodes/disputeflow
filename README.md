# DisputeFlow

DisputeFlow is a transaction-dispute backend split into two independently deployable services. Customers can open disputes and attach supporting evidence; operations agents can review cases through controlled status transitions.

The project runs entirely on a developer machine. Keycloak provides OAuth 2.0/OpenID Connect, PostgreSQL stores service-owned data, and `fake-gcs-server` provides the Google Cloud Storage API without requiring a GCP account.

## Services

- `dispute-service` owns disputes, idempotency records, and status history.
- `evidence-service` validates files, stores evidence in GCS, and owns evidence metadata.

The Evidence Service verifies access by calling the Dispute Service over REST. It never reads the other service's database.

The complete API contract is available in [`openapi.yaml`](openapi.yaml) and can be imported into Postman or Swagger Editor.

## Run locally

Requirements: Docker Desktop and Docker Compose.

```bash
docker compose up --build -d --wait
npm run smoke
```

The smoke test obtains real OIDC tokens, creates and replays an idempotent request, uploads a PDF, changes the dispute status as an operations agent, and reads the audit history.

Local endpoints:

| Component | URL |
| --- | --- |
| Dispute Service | `http://localhost:3001` |
| Evidence Service | `http://localhost:3002` |
| Keycloak | `http://localhost:8080` |
| GCS emulator | `http://localhost:4443` |

Demo identities are imported into the local realm:

| Role | Username | Password |
| --- | --- | --- |
| Customer | `customer1` | `customer-pass` |
| Operations agent | `agent1` | `agent-pass` |

These credentials are local development data and must not be reused elsewhere.

## API summary

```text
POST   /api/v1/disputes
GET    /api/v1/disputes
GET    /api/v1/disputes/:id
GET    /api/v1/disputes/:id/history
PATCH  /api/v1/disputes/:id/status

POST   /api/v1/disputes/:id/evidence
GET    /api/v1/disputes/:id/evidence
GET    /api/v1/evidence/:id/content
DELETE /api/v1/evidence/:id
```

Creating a dispute requires an `Idempotency-Key` header. Evidence uploads use `multipart/form-data` and accept PDF, JPEG, or PNG files up to 5 MB.

## Development checks

```bash
npm install
npm run lint
npm test
npm audit --omit=dev
```

GitHub Actions runs the same checks and builds both containers. Successful changes on `main` publish versioned images to GitHub Container Registry.
