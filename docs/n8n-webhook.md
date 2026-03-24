# n8n Webhook Integration — SocialDrop Copy Generation

## Overview

SocialDrop triggers an n8n webhook when the user clicks "Generar copy con IA" on a content item.
After n8n finishes generating the copy (caption, hashtags, title, tags), it calls back the
SocialDrop API to persist the generated text.

---

## Step 1 — SocialDrop sends to n8n

**Endpoint:** `POST {N8N_WEBHOOK_URL}` (configured in `.env` as `N8N_WEBHOOK_URL`)

**Payload:**

```json
{
  "contentId": "clxxxxxxxxxxxxxxx",
  "type": "SOCIAL",
  "tema": "beneficios del café colombiano",
  "platforms": ["INSTAGRAM", "TIKTOK"],
  "callbackUrl": "http://localhost:3333/api/content/clxxxxxxxxxxxxxxx/copy-callback"
}
```

| Field         | Type       | Description                                                        |
|---------------|------------|--------------------------------------------------------------------|
| `contentId`   | `string`   | cuid of the ContentItem in the database                            |
| `type`        | `string`   | One of `SOCIAL`, `YT_SHORT`, `YT_LONG`                            |
| `tema`        | `string`   | The main topic/idea for the content                                |
| `platforms`   | `string[]` | Target platforms (e.g. `INSTAGRAM`, `TIKTOK`, `YOUTUBE`)          |
| `callbackUrl` | `string`   | Full URL n8n must POST the generated copy back to                  |

---

## Step 2 — n8n calls SocialDrop back

After generating the copy, n8n must call the `callbackUrl` provided in the payload.

**Method:** `POST {callbackUrl}`

**Payload for `SOCIAL` type:**

```json
{
  "caption": "El café colombiano es mundialmente reconocido por su sabor suave y aromático...",
  "hashtags": ["#cafecolombia", "#coffeelover", "#caféorgánico"]
}
```

**Payload for `YT_SHORT` or `YT_LONG` type:**

```json
{
  "title": "5 Razones para tomar café colombiano todos los días",
  "caption": "En este video te cuento los increíbles beneficios del café colombiano...",
  "tags": ["café colombiano", "beneficios del café", "coffee colombia"]
}
```

| Field      | Type       | Required for          | Description                                 |
|------------|------------|-----------------------|---------------------------------------------|
| `caption`  | `string`   | SOCIAL, YT_SHORT, YT_LONG | Description / body text                 |
| `hashtags` | `string[]` | SOCIAL                | Hashtags to be shown on social posts        |
| `title`    | `string`   | YT_SHORT, YT_LONG     | YouTube video title                         |
| `tags`     | `string[]` | YT_SHORT, YT_LONG     | YouTube tags                                |

---

## Step 3 — SocialDrop confirms

On a successful callback, SocialDrop:
1. Persists the generated fields on the `ContentItem` record.
2. Sets `copyGenerated = true`.
3. Clears the `n8nJobId` field.

The frontend polls every 3 seconds while a generation is in progress (`n8nJobId` is set) and
shows a toast notification when `copyGenerated` switches to `true`.

---

## Environment variables

```env
# URL of the n8n webhook trigger node
N8N_WEBHOOK_URL=http://your-n8n-instance.com/webhook/socialdrop-copy

# Base URL of the SocialDrop API (used to build callbackUrl)
NEXT_PUBLIC_API_URL=http://localhost:3333
```

---

## Error handling

- If `N8N_WEBHOOK_URL` is not set, the API returns `{ message: "N8N_WEBHOOK_URL not configured", item }` and does **not** update the item.
- If the n8n server is unreachable, the API logs the error but still returns `200` to the frontend. The `n8nJobId` will remain `pending-{timestamp}` — you can retry by clicking "Generar copy" again.
- The callback endpoint (`POST /api/content/:id/copy-callback`) is unauthenticated; only call it from your private n8n instance.
