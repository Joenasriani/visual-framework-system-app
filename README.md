# Visual Framework App

Visual Framework is a system for making structured thought visible, inspectable, executable, challengeable, reframable, and reusable.

A Frame may hold information, an explicit order, or both. An executable Frame can run independently when its required input is available. In a Framework Run, completed Frame outputs become available to downstream Frames so the chain resolves visibly Frame by Frame.

## Current product phase

Desktop is the only canonical interface.

Do not introduce a separate mobile interaction model until the desktop experience is finished and accepted. The later mobile version should be adapted from the completed desktop product with a reduced feature set.

## MVP foundation

1. Typed Frames and ports
2. Direct visual relationships
3. Reusable data assets
4. Deterministic operations
5. Online model operations
6. Graph validation and cycle rejection
7. Execution trace per Frame
8. Local persistence
9. Desktop canvas with direct manipulation
10. Independent Frame execution as a target capability
11. Progressive Framework execution as a target capability

## MVP reasoning operations

The first reusable reasoning operations are:

1. Decompose
2. Move Up
3. Move Down
4. Challenge Assumptions
5. Reframe
6. Find Missing Structure
7. Validate Structure

These operations were selected because they directly serve recursive structural reasoning and remain compatible with the current simple Frame runtime.

See `FRAMEWORK_TASKS.md` for the complete mission filtered task register.

## Online model

The app is locked to one model:

`nvidia/nemotron-3-ultra-550b-a55b:free`

No paid fallback model is configured.

### Vercel variable

Add this environment variable in Vercel:

`FW_API=your_openrouter_api_key`

Add it to Production and Preview, then redeploy.

The key is read only inside `api/model.js`. It is never sent to the browser.

Free endpoints are rate limited and may log prompts. Do not send confidential or personal data through the free model endpoint.

## Run locally

Static and local operations work with:

```bash
python3 -m http.server 4173
```

Online model Frames require a Vercel compatible serverless environment with `FW_API` configured.

## Expression operators

1. `notEmpty(input)`
2. `length(input)`
3. `uppercase(input)`
4. `lowercase(input)`
5. `json(input)`
