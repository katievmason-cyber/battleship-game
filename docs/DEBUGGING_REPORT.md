# Debugging report

Battleship vs. AI: https://katievmason-cyber.github.io/battleship-game/ · source: https://github.com/katievmason-cyber/battleship-game

## Summary
The first version (rules, AI and game screen) had three issues worth recording: one in deployment, one in the development workflow and one false alarm during testing. No defects were found in the game itself.

Adding ship pictures and drag-and-drop then introduced five real game bugs, caught in three different ways: one from checking screenshots, two from the recorded browser test, and two flagged by automated code review (Devin Review) on the pull request. All five were fixed before the change went live. The full log is in [BUGS.md](BUGS.md) and the evidence is in [TESTING.md](TESTING.md).

## Why so few game bugs
The plan listed the risky areas up front (edge placement, rapid clicks, the computer cheating, deployment paths) and each one got a test or a safeguard before it could become a bug:
- The rules, the AI and the screen are separate pieces of code, so the rules and the AI can be tested without a browser (33 automated tests at first, now 41, run on every change).
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

### 4. Game: placing an upright ship stretched the board (GAME-001)
- **Found by:** checking screenshots while building the ship pictures.
- **Symptom:** after a ship was placed vertically, the board grew taller and its bottom row overlapped the text underneath.
- **Root cause:** each ship picture is an image (SVG) spanning several squares. An SVG with no fixed size defaults to 150 px tall, and the board's rows grew to fit it.
- **Fix:** the picture now fills the space its squares give it and never sets their size.
- **Verification:** the board measured 440 px tall both before and after placing vertical ships. Screenshots at desktop and phone width show square cells.

### 5. Game: a ship could be moved after the battle started (GAME-002)
- **Found by:** the recorded browser test.
- **Symptom:** while still holding a ship mid-drag, the tester pressed Start battle with the keyboard. When they let go, the ship moved during the battle and the status went back to "Press Start battle".
- **Root cause:** Random, Clear and New game cancelled a drag in progress, but Start battle didn't. The drop code also never checked that the game was still in setup.
- **Fix:** Start battle cancels any drag, and drops are ignored outside setup.
- **Verification:** the browser test repeated the same steps: the dragged ship disappeared as soon as Start battle was pressed, and letting go left the Carrier where it was.

### 6. Game: green preview, but the click was refused (GAME-003), a code-review flag
- **Found by:** Devin Review, automated code review on the pull request.
- **Symptom:** after a rejected drag of a ship already on the board, hovering showed green ("fits"), but clicking said it didn't fit and nothing moved.
- **Root cause:** the preview and the click used two different rules. The preview allowed moving a placed ship, but the click only allowed placing a new one.
- **Fix:** clicks now use the same "move" rule as the preview and dragging.
- **Verification:** browser retest: after a rejected drag, the empty row showed green and clicking moved the Carrier there.

### 7. Rules: a ship that had been hit could be moved (GAME-004), a code-review flag
- **Found by:** Devin Review.
- **Symptom:** none in the game, because the screen only lets you move ships during setup. But the rules code allowed it, and a moved ship would lose its hits. With those squares already fired at, it could never be sunk, so the game could never end.
- **Root cause:** moving a ship creates it afresh with no hits, and the code didn't check whether shots had already been fired.
- **Fix:** the rules refuse to move ships once the board has been fired at.
- **Verification:** a new automated test fires at a destroyer, tries to move it, and checks that it stays put and keeps its hit.

### 8. Game: the game-over buttons couldn't be clicked (GAME-005)
- **Found by:** the recorded browser test.
- **Symptom:** at the end of a game, clicking Play again or View boards did nothing. Escape still closed the dialog.
- **Root cause:** to draw ship pictures underneath the squares, the squares were told to "sit above" (a CSS setting called z-index). The game-over dialog had no such setting, so the squares ended up on top of it and caught the clicks.
- **Fix:** the dialog is now explicitly placed above the boards.
- **Verification:** browser retest at desktop (1280×900) and phone width (375 px): the element under each button is now the button itself, View boards closes the dialog and Play again resets to setup, both by mouse click and by touch tap.

## Lessons from the second round
- **Each check caught something different.** Screenshots caught a layout bug, the browser test caught a keyboard edge case and a hidden layering problem, and code review caught two logic gaps that no test had covered.
- **One rule, one place.** GAME-003 happened because two pieces of code each had their own version of the same rule. Making both use the same function fixed it.
- **A visual fix can break something elsewhere.** GAME-005 came from the change that put ship pictures under the squares. Only a test that played all the way to the end of a game found it.
- **Protect the rules engine even if the screen "never does that".** GAME-004 couldn't happen in the game, but fixing it means a future change can't trigger it by accident.

