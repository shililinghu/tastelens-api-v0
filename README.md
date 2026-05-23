# TasteLens API V0

TasteLens API V0 provides a local Express server for the single-file HTML demo and a mock image analysis endpoint.

## Run

```bash
npm install
npm start
```

Open:

```text
http://127.0.0.1:3000
http://localhost:3000
```

## Render Deploy

Create a Render Web Service from this repository.

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

Environment Variables:

```bash
MODEL_PROVIDER=doubao
ARK_API_KEY=火山方舟 API Key
ARK_MODEL=已开通的视觉模型 ID 或 Endpoint ID
DASHSCOPE_API_KEY=
```

Do not commit `.env` or `node_modules` to GitHub.

## Static Files

The server serves files from `public/`.

- `public/tastelens.html`
- `public/images/sample-user.jpg`
- `public/images/ref-1.jpg`
- `public/images/ref-2.jpg`
- `public/images/ref-3.jpg`

## API

`POST /api/analyze`

- FormData field: `image`
- Accepted types: `image/jpeg`, `image/png`
- Max size: 8MB
- Uploads are read from memory with `multer.memoryStorage()`
- Images are not saved to disk

Errors are returned as JSON:

```json
{ "error": "xxx" }
```

## Model Provider

Copy `.env.example` to `.env`, then choose a provider:

```bash
MODEL_PROVIDER=mock
```

Mock mode returns `DEBUG MOCK ONLY` plus upload metadata, which is useful for verifying the frontend API path.

```bash
MODEL_PROVIDER=qwen
DASHSCOPE_API_KEY=your_dashscope_api_key
QWEN_MODEL=qwen-vl-plus
```

```bash
MODEL_PROVIDER=doubao
ARK_API_KEY=your_ark_api_key
ARK_MODEL=your_enabled_vision_model_or_endpoint_id
```

`ARK_MODEL` must be a vision model ID or Endpoint ID that has already been enabled in the Volcengine Ark Console. If the API returns `ModelNotOpen`, open that model in Ark Console first, or replace `ARK_MODEL` with a vision model / endpoint that is already enabled for your account.

If `MODEL_PROVIDER` is not set, the server defaults to `mock`.

The console prints the active provider when the server starts and when `/api/analyze` receives a request.
