# Bug log

Every real bug found while building this game, recorded when it was found. Nothing here is invented or planted.

Each entry records:
- **Found by:** automated test, play-testing, code review, CI, or the live site
- **Symptom:** what went wrong, from a player's point of view
- **Steps to reproduce**
- **Root cause:** why it happened, and where in the code
- **Fix:** what changed (commit / PR link)
- **Verification:** the regression test (failing before the fix, passing after) and any manual check

---

## Game bugs

### GAME-001: Placing a vertical ship stretched the board
- **Found by:** Devin, checking screenshots while building ship shapes and drag-and-drop
- **Symptom:** After a ship was placed vertically, Your fleet grew taller. The bottom row overlapped the "Computer shots" line underneath.
- **Steps to reproduce:** On the ship-shapes branch before the fix, drag the Battleship onto the board, press R while dragging, and drop it.
- **Root cause:** Each ship picture is an SVG inside an item that spans several grid squares. An SVG with no fixed size defaults to 150 px tall, and CSS grid rows grow to fit their contents, so the rows under a vertical ship got taller (`site/style.css`, `.ship-shape svg`).
- **Fix:** The picture is now absolutely positioned inside its item, and the item has `min-height: 0`, so the picture fills whatever space the squares give it and never sets their size.
- **Verification:** The board's measured height was 440 px both before and after Random placed vertical ships. Screenshots at desktop and 375 px widths show square cells and no overlap.

### GAME-002: A ship could be moved after the battle had started
- **Found by:** recorded browser test (testing agent) of the drag-and-drop branch
- **Symptom:** If you were still holding a ship mid-drag and pressed Start battle with the keyboard, the dragged ship stayed under the pointer. Letting go moved your ship *during the battle*, and the status went back to "Fleet ready… Press Start battle".
- **Steps to reproduce:** Random, then start dragging the Carrier from the palette and keep the mouse button held. Tab to Start battle and press Space. Drop the ship on any free run of 5 squares.
- **Root cause:** Random, Clear and New game cancelled an active drag, but Start battle didn't. The drop handler also never checked whether the game was still in setup (`onPointerUp` in `site/js/ui.js`).
- **Fix:** `startBattle` now cancels any drag, and `onPointerUp` ignores drops unless the game is still in the setup phase.
- **Verification:** see TESTING.md (retest of this repro).

### GAME-003: A green preview, but clicking said the ship didn't fit
- **Found by:** automated code review (Devin Review) on PR #7
- **Symptom:** After a rejected drag of a ship that was already on the board, that ship stayed selected. Hovering showed green (fits), but clicking said it "doesn't fit on the board there" and nothing moved.
- **Steps to reproduce:** Drag a placed Carrier off the board and let go. Hover an empty row so it shows green, then click.
- **Root cause:** The preview used the new `checkMove` (a placed ship may move), but clicks still used `placeShip`, which refuses a ship that's already on the board (`onPlayerBoardClick` in `site/js/ui.js`).
- **Fix:** Clicks now use `moveShip`, the same rule as the preview and drag-and-drop.
- **Verification:** see TESTING.md (retest).

### GAME-004: The rules engine allowed moving a ship that had been hit
- **Found by:** automated code review (Devin Review) on PR #7
- **Symptom:** None in the game: the screen only lets you move ships during setup. But a ship moved after being hit would lose its hits, and with those squares already fired at it could never be sunk, so the game couldn't end.
- **Root cause:** `moveShip` creates a fresh ship (with no hits) and didn't check whether the board had been fired at (`site/js/game.js`).
- **Fix:** `moveShip` refuses with `battle-started` once the board has any shots.
- **Verification:** New unit test "ships can't be moved once the board has been fired at": the destroyer stays put and keeps its hit.

Earlier phases: the rules engine and AI tests passed on the first run, and the recorded browser test of the live site found no reproducible game bugs (see [TESTING.md](TESTING.md)).

One false alarm, not counted as a bug: during browser testing a fast double-click looked like it gave the player two shots in a row. Measuring showed the test tool had paused about 1 second between clicks, longer than the computer's 0.6-second "thinking" delay, so the computer had already replied. Re-tested with three real clicks 31 ms apart: exactly one shot was accepted.

## Deployment issues

### DEP-001: Deploying needed a setting only the repo owner could change
- **Found by:** Devin, while setting up deployment (Phase 1)
- **Symptom:** The automated attempt to switch on GitHub Pages failed with `403 Resource not accessible by integration`, so the deploy workflow had nowhere to publish.
- **Root cause:** Devin's GitHub access can push code and open PRs, but it isn't allowed to change repository settings, and the Pages source is a setting. (This risk was predicted in the plan.)
- **Fix:** Kate set Settings → Pages → Source = **GitHub Actions**.
- **Verification:** After PR #1 merged, the *Deploy to GitHub Pages* workflow succeeded and https://katievmason-cyber.github.io/battleship-game/ returned HTTP 200 with the placeholder page. `style.css` also loaded (HTTP 200), confirming the relative paths work under the `/battleship-game/` sub-folder.

## Workflow issues

Problems with how changes were reviewed and merged. These didn't affect the live game.

### WF-001: Merging Phase 1 accidentally closed the Phase 2 pull request
- **Found by:** GitHub notification, right after merging PR #1
- **Symptom:** [PR #2](https://github.com/katievmason-cyber/battleship-game/pull/2) (rules engine) changed to *Closed*, not merged, even though nobody had closed it.
- **Steps to reproduce:** Open PR B whose base is PR A's branch (a "stacked" PR). Merge PR A with `gh pr merge --delete-branch`.
- **Root cause:** PR #2 was built on top of PR #1's branch (`devin/phase1-foundations`) rather than `main`. Merging PR #1 with `--delete-branch` deleted that branch, and GitHub closed PR #2 because the branch it was aimed at no longer existed. (Observed behaviour. GitHub can retarget such PRs automatically in some cases, but it didn't here.)
- **Fix:** Re-created `devin/phase1-foundations` at the same commit, reopened PR #2, then changed its base to `main`. [PR #3](https://github.com/katievmason-cyber/battleship-game/pull/3) was retargeted to `main` *before* its base branch could be deleted, so it didn't happen twice.
- **Prevention:** When PRs are stacked, retarget the next PR to `main` before deleting the merged branch.
- **Verification:** PR #2 reopened with base `main`, its CI passed, and it was then merged normally. PR #3 and PR #4 were retargeted to `main` before their base branches were deleted, and both merged normally.

