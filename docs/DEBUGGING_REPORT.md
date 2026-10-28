# Debugging report

Battleship vs. AI: https://katievmason-cyber.github.io/battleship-game/ · source: https://github.com/katievmason-cyber/battleship-game

## Summary
The project had three issues worth recording: one in deployment, one in the development workflow and one false alarm during testing. No defects were found in the game itself. The full log is in [BUGS.md](BUGS.md) and the evidence is in [TESTING.md](TESTING.md).

## Why so few game bugs
The plan listed the risky areas up front (edge placement, rapid clicks, the computer cheating, deployment paths) and each one got a test or a safeguard before it could become a bug:
- The rules, the AI and the screen are separate pieces of code, so the rules and the AI can be tested without a browser (33 automated tests, run on every change).
- The AI is only given its own shot results, never the player's board, so it can't cheat even by accident.
- Randomness is "seeded" (repeatable), so random fleets and 1,000-game AI simulations give the same result every run.
- Clicks only count on the player's turn, and New game cancels the computer's pending move.
- The site is only published after the tests pass.

## Issues

### 1. Deployment: needed a setting only the repo owner could change (DEP-001)
- **Symptom:** switching on GitHub Pages automatically failed with error 403, so the site had nowhere to publish.
- **Root cause:** the AI assistant's GitHub access can change code but not repository settings.
- **Fix:** the repo owner set Settings → Pages → Source to *GitHub Actions*.
- **Verification:** the deploy succeeded and the public link returned HTTP 200, with its style sheet loading correctly.

### 2. Workflow: merging one change closed the next one (WF-001)
- **Symptom:** after Phase 1 was merged, the Phase 2 pull request showed as *Closed* without anyone closing it.
- **Root cause:** Phase 2 had been built on top of Phase 1's branch. Merging Phase 1 deleted that branch, and GitHub closed Phase 2 because its target no longer existed.
- **Fix:** restored the branch, reopened Phase 2 and pointed it at the main code.
- **Prevention:** later changes were pointed at the main code before the branch beneath them was deleted. It didn't happen again.
- **Verification:** all five pull requests merged normally. The live game was never affected.

### 3. Testing: a "double shot" that wasn't a bug
- **Symptom:** in the browser test, a fast double-click seemed to give the player two shots in a row.
- **Root cause:** the test tool paused about 1 second between clicks. That's longer than the computer's 0.6-second delay, so the computer had already taken its turn. The game was behaving correctly.
- **How we confirmed it:** we re-tested with three real clicks 31 ms apart. Exactly one shot counted and the computer replied once, after 601 ms.
- **Lesson:** measure before calling something a bug. The tool used to observe a problem can cause it.
