# Visual Framework App

A zero-dependency visual environment for composing, validating, executing, and inspecting typed computational workflows.

## MVP
- Typed frames and ports
- Direct visual linking
- Reusable data assets
- Deterministic instructions and expressions
- OpenRouter model frames
- Graph validation and cycle rejection
- Execution trace per frame
- Local persistence
- Desktop-first responsive UI

## Online model
The app is locked to one model:

`nvidia/nemotron-3-ultra-550b-a55b:free`

No paid fallback model is configured.

### Vercel variable
Add this environment variable in Vercel:

`FW_API=your_openrouter_api_key`

Add it to Production and Preview, then redeploy.

The key is read only inside `api/model.js`; it is never sent to the browser.

Free endpoints are rate-limited and may log prompts. Do not send confidential or personal data through the free model endpoint.

## Run locally
Static/local operations work with:

```bash
python3 -m http.server 4173
```

Online model frames require a Vercel-compatible serverless environment with `FW_API` configured.

## Expression operators
- `notEmpty(input)`
- `length(input)`
- `uppercase(input)`
- `lowercase(input)`
- `json(input)`
