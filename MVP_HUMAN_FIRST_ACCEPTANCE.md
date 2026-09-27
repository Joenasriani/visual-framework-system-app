# Human-first MVP acceptance

Status: implementation under review; human use and live AI not yet verified.

## Product boundary

Improve the existing interaction, not the reasoning architecture. Keep the frozen VFS work out of this release. Preserve existing maps and the original regression example. New map and Example must create separate documents rather than overwrite current work.

The interface should explain Add, Connect, Think and Run as the person uses them. Do not require a separate manual or an opening tutorial modal. Keep advanced controls available under More tools. Use a coherent neutral workstation surface rather than decorative purple/indigo accents.

Solid cables pass results between items. Descriptive links express relationships such as Supports; they do not change execution order or prove the relationship. Both must stay visible and distinguishable.

## Automated review

Run the production build of the exact review commit, not an older public URL.

- First visitor starts with an empty map and actionable choices. Run is disabled on an empty map.
- Adding opens editing, focuses content, does not call AI and does not overlap existing items.
- Escape closes editing even when a text field is focused. Touch users have a visible close control.
- Actual item content appears on the canvas.
- Drag and touch connection paths work; named relationship labels remain visible without selection.
- Thinking tools reveal their scope, open the suggestion panel automatically and do not mutate the map before Apply.
- Dismiss preserves the graph. Apply, Undo and Redo preserve reversible changes.
- Run opens saved input, method, result and failure details without truncating the only result view.
- The example produces a text result, not merely a true/false check.
- New map and Example preserve earlier documents; reload restores the active map.
- Provider failure gives a visible message and recovery does not erase the map.
- Desktop, tablet, narrow touch screens, keyboard editing and reduced-motion settings are checked.
- Existing connection geometry, invalid-connection rejection, grouping, hierarchy, structural tools and true offline reload remain covered by their regression suites.

The new automated first-use suite mocks AI responses. Its success is not proof of live AI reliability, answer quality, human comprehension or a deployed preview. Capture screenshots and record the exact commit and workflow run.

## Rendered review

Inspect screenshots, not only DOM counts. Check readable type, contrast, control hierarchy, actual note content, visible relationship labels, absence of decorative indigo, non-overlapping panels and reachable actions. Screenshots made with test data must not be presented as independently verified AI answers.

## Human release check

Use the verified preview build. Record its URL and commit. Include the product owner and unfamiliar users; as a small practical release check, try three people who have not used VFA. This is not a statistical claim about universal usability.

Give only this task: “Map something you are thinking about and use the app to explore it.” Built-in guidance is allowed; external coaching is not. Observe rather than explain.

Record whether each person can add and edit two items, connect them, describe what the line means, add or deliberately skip a descriptive relationship, choose a thinking tool, understand and apply or dismiss its suggestion, run the map and explain what the result represents.

Ask them to change an item and repeat. Verify that they distinguish their own text, an AI suggestion and a completed run. They should know how to return to their saved map after opening the example.

Record the exact blocked action, mistaken expectation, request for help and recovery. A critical block or misunderstood result keeps the human gate open. Fix observed friction, then retest without coaching. Never invent participants, quotations or outcomes.

## Release gate

Merge and production freeze require passing automated checks on the release commit, rendered review, real human acceptance, live AI verification and production checks on the same approved build. Campaign claims must separate currently demonstrated functions from the future roadmap.
