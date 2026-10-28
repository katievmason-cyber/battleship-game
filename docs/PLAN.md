# Battleship vs. AI — Project Plan (draft for your approval)

*Plain-English version. Nothing gets built until you approve.*

---

## 1. What we're building, and what "done" looks like

### The game, in one paragraph
A web page anyone can open from a link. You place 5 ships on your 10x10 grid. The computer secretly places its own 5 ships. You take turns firing at each other's grids. Each shot is a **hit**, a **miss**, or **"you sunk my …"**. The first player to sink the whole enemy fleet wins.

### Requirements (what the game must do)

| # | Requirement | Why it matters |
|---|---|---|
| R1 | Two 10x10 boards: **Your fleet** and **Enemy waters** | Core game |
| R2 | Classic fleet: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2 (17 squares) | Standard rules people know |
| R3 | Place ships by clicking, rotate them, or press **Random**. Ships can't overlap or hang off the edge | Setup must be easy and impossible to get "wrong" |
| R4 | Click an enemy square to fire. Show hit / miss / sunk clearly (with symbols, not just colours) | Core game, plus colour-blind players |
| R5 | The computer fires back after each of your shots | You vs. AI |
| R6 | The AI plays sensibly: it searches, then once it hits, it finishes off that ship | So it feels like a real opponent |
| R7 | The AI never cheats: it can't see your ships, and never fires at the same square twice | Fairness |
| R8 | Win / lose screen and **New game** button | A game has to end cleanly |
| R9 | Status line telling you whose turn it is and what happened | So players never feel lost |
| R10 | Works on a laptop and a phone, in Chrome, Safari, Firefox, Edge | "People can play online" |
| R11 | Public link, no login, no install | Deliverable #1 |
| R12 | Public GitHub repo with readable code, a README and automated tests | Deliverable #2 |
| R13 | A bug report: real bugs, root causes, fixes, how we checked | Deliverable #3 |

### Success criteria (how we'll *prove* it's done)
These are checkable, not "it feels finished":

1. **A full game can be played start to finish** on desktop and mobile with no errors in the browser's error console.
2. **Automated tests pass** on every change (run automatically by GitHub, shown as a green tick).
3. **The AI is fair and competent**, measured by simulating 1,000 games automatically:
   - it never fires the same square twice and never looks at your ship positions;
   - it sinks a full fleet in roughly **45–60 shots on average** (pure random guessing needs ~95, so this shows the AI is genuinely "thinking").
4. **The public link works** for someone who has never seen the project (we'll test from a fresh browser and a phone).
5. **The bug report is accurate**: every bug listed actually happened, links to the fix, and has a test that proves it's fixed.

### Out of scope (to stop the project growing)
Multiplayer between two humans, accounts/logins, leaderboards, sound, animations beyond the basics. Possible "nice-to-haves" if time allows: difficulty levels, a "Hard" AI.

---

## 2. Recommended technology (and why)

| Layer | Choice | Why, in plain English |
|---|---|---|
| Game screen | **Plain HTML, CSS, JavaScript** | The three languages every web browser already understands. No frameworks (like React) to learn or explain. Fewer moving parts = fewer things to break. |
| Where the AI runs | **In the player's browser** (JavaScript) | No server needed. The AI's "thinking" is a small set of rules, so it's instant. |
| Tests | **Node.js built-in test runner** (`node --test`) | Runs the game logic without a browser, thousands of times, in seconds. No extra tools to install. |
| Browser testing | **Recorded manual play-through** in a real browser, plus one small automated "smoke test" (opens the page, plays a few moves) if useful | Catches screen/click problems that logic tests can't see. |
| Code hosting | **GitHub** (public repo) | Required deliverable; also gives us change history and reviews. |
| Automatic checks | **GitHub Actions** | Every time code changes, GitHub runs the tests and shows a green tick or red cross. |
| Hosting the game | **GitHub Pages** (free) | Turns the repo into a public website. Same place as the code, no extra accounts, auto-updates when we merge changes. |

**Why not something fancier?** A database, server, or framework would add cost, accounts, security concerns and failure points without making the game better. A good engineer picks the simplest tool that meets the requirements; that's a nice point to make in the interview.

---

## 3. Architecture (how the pieces fit together)

Think of it as three separate boxes that talk through narrow "windows":

```
 ┌────────────────────────┐      ┌─────────────────────────┐
 │  SCREEN  (ui.js)       │      │  AI OPPONENT  (ai.js)   │
 │  draws boards, handles │      │  decides where the      │
 │  clicks, shows messages│      │  computer fires next    │
 └──────────┬─────────────┘      └────────────┬────────────┘
            │ "player fired at B7"            │ "I fire at E4"
            ▼                                 ▼
 ┌───────────────────────────────────────────────────────────┐
 │  RULES ENGINE  (game.js)                                  │
 │  boards, ships, placement rules, hit/miss/sunk,           │
 │  whose turn it is, has anyone won?                        │
 │  (the "referee": the only place game rules live)          │
 └───────────────────────────────────────────────────────────┘
```

- **Rules engine (the referee).** Knows the rules and the true state of the game. Has no idea what a screen is, which means we can test it automatically without a browser.
- **AI opponent.** Only ever receives *what a human player would know*: which squares it has fired at and whether each was a hit, miss or sink. It is never given your ship positions. This is how we guarantee it doesn't cheat — by design, not by promise.
- **Screen.** Draws what the referee says and passes clicks to it. Holds no rules of its own, so the screen can't accidentally allow an illegal move.

**Why split it this way?** Each box can be tested and fixed on its own. If a bug appears, the split tells us where to look.

### How the AI opponent works
This is a classic rule-based strategy ("hunt and target"), not ChatGPT-style AI. Worth saying clearly in the interview: *AI here means a decision-making algorithm*.

1. **Hunt mode (searching).** The AI fires in a **checkerboard pattern** (only "black squares"). Every ship is at least 2 long, so every ship must cover at least one black square. This halves the searching.
2. **Target mode (after a hit).** It fires at the squares directly next to the hit (up/down/left/right).
3. **Line mode (after 2 hits in a row).** It now knows the ship's direction, so it keeps going along that line, and turns round to try the other end when it hits water.
4. **Sunk.** When the referee says "sunk", the AI crosses that ship off and goes back to hunting, unless it still has unexplained hits (which happens when two ships are touching).
5. **Small human touch.** A short pause (~0.5 s) before the AI fires, so the player can follow what's happening.

**Optional "Hard" mode (stretch goal):** for every unknown square, count how many ways the remaining ships could still fit over it, and fire at the most likely square. Stronger (~40–45 shots), more complex to explain and test.

---

## 4. Development plan

We'll work like a real software team: each step is a small **branch → pull request (PR) → automatic tests → your review → merge** cycle. Merging to the main branch automatically redeploys the live game. You approve at each ✅ checkpoint.

| Phase | What happens | What you'll see | Checkpoint |
|---|---|---|---|
| **0. Plan** | This document | This document | ✅ You approve the plan |
| **1. Foundations** | Create the repo, README, the automatic-test pipeline, and deploy a **"Hello world" page to the public link on day one** | A live (empty) web page + green tick on GitHub | ✅ Link works |
| **2. Rules engine** | Boards, ships, placement rules, firing, sinking, winning. Unit tests for each rule | Tests listed in the PR, all passing | ✅ Review PR |
| **3. AI opponent** | Hunt / target / line logic. Tests + a 1,000-game simulation proving no repeat shots and the average shot count | Simulation results in the PR | ✅ Review PR |
| **4. Screen** | Ship placement, battle, status messages, win/lose, new game, phone layout | Playable game on the live link | ✅ You play it |
| **5. Testing** | Edge-case tests (section 5), a recorded play-through in a real browser, phone check, cross-browser check | Video + test results | ✅ Review results |
| **6. Debugging** | Happens *throughout*, not just at the end. Each real bug is logged as it's found (see below) | `docs/BUGS.md` grows | — |
| **7. Release** | Final deploy, test the public link from a clean browser and a phone, tidy README | Final link + repo | ✅ Final sign-off |
| **8. Report** | Turn the bug log into your short debugging document | Draft report for you to edit | ✅ Your edit |

**Why deploy "Hello world" first?** Deployment is the step most likely to surprise us (settings, permissions, file paths). Doing it on day one removes that risk early instead of finding it at the deadline.

### How bugs will be recorded (for your report)
A file in the repo, `docs/BUGS.md`, updated **at the moment each bug is found**, one entry per bug:

- **ID and title**, e.g. *BUG-003: AI fires twice after New game*
- **How it was found** (automated test, play-testing, code review, live site)
- **Symptom**: what went wrong, from a player's point of view
- **Steps to reproduce**
- **Root cause**: *why* it happened, in plain English and the exact code location
- **Fix**: what changed, with a link to the commit/PR
- **Verification**: the test written to catch it (shown failing before the fix and passing after), plus any manual check

**Honesty rule:** only real bugs go in. I won't invent or plant bugs to make the report look fuller. If the bug count is small, that's fine; the report can also cover issues caught *before* they shipped (by tests or review), which is exactly what a good process is supposed to do.

---

## 5. Risks and edge cases

### Game-logic edge cases (each will get an automated test)
- Placing a ship that hangs off the edge, or overlaps another ship, especially after **rotating** near the edge.
- **Random** placement getting stuck in an endless loop trying to fit ships (needs a retry limit).
- Firing at a square you've **already fired at** (must be ignored, not cost you a turn).
- **Two ships touching**: the AI hits both and must not give up on the second one after the first sinks.
- The AI running out of neighbouring squares to try (all neighbours already fired at).
- The AI's checkerboard running out while ships remain (must fall back to the remaining squares).
- The game must stop **the instant** the last ship sinks: the AI must not fire after you've won.

### Screen / timing edge cases (classic sources of real bugs)
- **Double-clicking** or clicking fast during the AI's pause → firing two shots in one turn.
- Clicking **New game** while the AI is "thinking" → the old game's delayed shot lands in the new game.
- Clicking your own board, or the enemy board during setup / after the game ends.
- **Phones**: tap targets too small on a 10x10 grid; "hover preview" for placement doesn't exist on touch screens.

### Deployment risks
- **Permissions:** turning on GitHub Pages is a repo setting. My GitHub access may not allow it, in which case **you'd click one setting** (I'll send a screenshot of exactly where).
- **File paths:** GitHub Pages serves the site from a sub-folder (`…github.io/repo-name/`) and is case-sensitive, so links that work on my machine can break live. Testing the real link catches this.
- **Caching:** browsers may show an old version after an update; we'll verify with a hard refresh/private window.

### Project risks
- **Randomness makes tests unreliable** (a test passes on Monday, fails on Tuesday). Fix: let tests use a fixed "random seed" so every run is repeatable.
- **Scope creep**: sticking to the requirements table; extras only after the core is live.
- **"Cheating" via browser tools:** since there's no server, a technical player *could* peek at the computer's ships using browser developer tools. Acceptable for a casual game; worth mentioning in the interview as a conscious trade-off (fixing it needs a server).

---

## 6. Decisions (approved by Kate)
- **Repo:** new public repo `battleship-game`, built from scratch (the earlier `battleship` repo is left untouched).
- **Rules:** classic. Ships may touch; turns alternate even after a hit.
- **AI:** one smart hunt/target AI first; "Hard" mode only if time allows.
- **Hosting:** GitHub Pages, deployed by GitHub Actions after tests pass.
- **Reviews:** Kate reviews at the 5 checkpoints.
