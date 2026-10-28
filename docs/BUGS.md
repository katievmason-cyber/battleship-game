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

_None found yet. Phases 2 (rules engine) and 3 (AI) passed all their tests on the first run._

## Process and deployment issues

### PROC-001: Deploying needed a setting only the repo owner could change
- **Found by:** Devin, while setting up deployment (Phase 1)
- **Symptom:** The automated attempt to switch on GitHub Pages failed with `403 Resource not accessible by integration`, so the deploy workflow had nowhere to publish.
- **Root cause:** Devin's GitHub access can push code and open PRs, but it isn't allowed to change repository settings, and the Pages source is a setting. (This risk was predicted in the plan.)
- **Fix:** Kate set Settings → Pages → Source = **GitHub Actions**.
- **Verification:** After PR #1 merged, the *Deploy to GitHub Pages* workflow succeeded and https://katievmason-cyber.github.io/battleship-game/ returned HTTP 200 with the placeholder page. `style.css` also loaded (HTTP 200), confirming the relative paths work under the `/battleship-game/` sub-folder.

### PROC-002: Merging Phase 1 accidentally closed the Phase 2 pull request
- **Found by:** GitHub notification, right after merging PR #1
- **Symptom:** [PR #2](https://github.com/katievmason-cyber/battleship-game/pull/2) (rules engine) changed to *Closed*, not merged, even though nobody had closed it.
- **Steps to reproduce:** Open PR B whose base is PR A's branch (a "stacked" PR). Merge PR A with `gh pr merge --delete-branch`.
- **Root cause:** PR #2 was built on top of PR #1's branch (`devin/phase1-foundations`) rather than `main`. Merging PR #1 with `--delete-branch` deleted that branch, and GitHub closed PR #2 because the branch it was aimed at no longer existed. (Observed behaviour. GitHub can retarget such PRs automatically in some cases, but it didn't here.)
- **Fix:** Re-created `devin/phase1-foundations` at the same commit, reopened PR #2, then changed its base to `main`. [PR #3](https://github.com/katievmason-cyber/battleship-game/pull/3) was retargeted to `main` *before* its base branch could be deleted, so it didn't happen twice.
- **Prevention:** When PRs are stacked, retarget the next PR to `main` before deleting the merged branch.
- **Verification:** PR #2 reopened with base `main`, its CI passed, and it was then merged normally. PR #3 shows base `main` and is still open.

