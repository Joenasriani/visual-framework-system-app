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

## Interaction motion contract

Motion must make Frame and relationship manipulation easier to read and feel, without changing structural precision.

1. Follow Through

When a Frame stops moving, its stored position is already final. Connected cable endpoints remain exactly attached to their ports. Only the cable body may continue moving briefly before settling.

2. Overlapping Action

The Frame, cable body, halo, and port response do not all stop at the same instant. Their timing is staggered slightly so the interaction has continuity while remaining restrained.

3. Ease In

Residual cable movement loses energy smoothly before reaching rest. No abrupt stop should occur after a meaningful drag gesture.

4. Settling Bounce

The Frame may use a very small scale and depth overshoot when released. Positional bounce is not allowed because it would reduce placement precision. Cable curvature may cross neutral slightly before damping to rest.

5. Connection Creation

A new cable visually resolves into place, followed by a quieter halo response and a brief target port acknowledgement.

6. Connection Removal

A selected relationship exposes one temporary remove control. Removing it retracts the cable before the relationship disappears from the Framework.

7. Motion Meaning

Do not animate cables continuously for decoration. Motion must correspond to manipulation, connection, removal, execution, state change, or another real Framework event.

8. Reduced Motion

Respect the user's reduced motion preference. Structural behavior must remain fully usable without follow through or settling effects.

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
