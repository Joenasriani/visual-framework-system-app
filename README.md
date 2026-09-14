# Visual Framework App

A zero-dependency visual environment for composing, validating, executing, and inspecting typed computational workflows.

## MVP
- Typed frames and ports
- Direct visual linking
- Reusable data assets
- Deterministic instructions and expressions
- Explicit model-mediated mode
- Graph validation and cycle rejection
- Execution trace per frame
- Local persistence
- Desktop-first responsive UI

## Run locally
```bash
python3 -m http.server 4173
```
Open `http://localhost:4173`.

## Expression operators
- `notEmpty(input)`
- `length(input)`
- `uppercase(input)`
- `lowercase(input)`
- `json(input)`

Model frames are intentionally explicit: without a configured provider they stop with `Model provider not configured` rather than fabricating output.
