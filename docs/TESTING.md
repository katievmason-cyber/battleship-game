# Test results

## Automated tests
`npm test` runs 33 tests (Node's built-in test runner) on every pull request and before every deploy:
- **Rules engine** (`tests/game.test.js`, 20 tests): placement at edges, rotation, overlap, touching ships, random placement over 500 seeds, hit/miss/sunk, repeat shots, turn order, game over.
- **AI** (`tests/ai.test.js`, 11 tests): no repeated or off-board shots over 1,000 games, beats random guessing, follows a ship's line, turns around at water, handles ships packed together or in corners, and only sees its own shot results.
- **Site** (`tests/site.test.js`, 2 tests): page metadata, and every file the page loads exists with the exact same name (GitHub Pages is case-sensitive).

## AI strength (`node scripts/simulate.js 1000`)
| | Mean shots | Median | Best | Worst |
|---|---|---|---|---|
| Hunt/target AI | 51.4 | 53 | 23 | 69 |
| Random guessing | 95.7 | 97 | 70 | 100 |

## Browser test of the live site
Recorded test of https://katievmason-cyber.github.io/battleship-game/ in Chrome, using normal clicks plus scripted mouse/touch input where precise timing was needed.

| Area | Checked | Result |
|---|---|---|
| Setup | Previews (green valid / red invalid), rotate button and `R`, edge and overlap rejection, touching ships, picking ships back up, Random, Clear, Start disabled until all 5 ships placed, clicking enemy board during setup | Pass |
| Battle | Hit/miss/sunk display, sunk ship named in log, newest-first log, stats and accuracy, latest shot outlined, turns alternate after a hit | Pass |
| Repeat shot | Firing at an already-hit square shows a message; no turn, log or stats change | Pass |
| Rapid clicks | 3 clicks within 31 ms: exactly 1 player shot, computer replied once after 601 ms | Pass |
| New game mid-turn | New game 14 ms after firing: the computer's pending shot was cancelled; board, log and stats empty | Pass |
| `R` during battle | No effect | Pass |
| AI behaviour | Followed ships along a line (e.g. D5 → E5 → F5); a full losing game had 64 shots, none repeated | Pass |
| Win / loss | Won in 18 shots (94% accuracy); lost after 64 computer shots; correct dialogs, View boards and Escape close them, surviving enemy ships shown after a loss, no firing after game over, Play again resets | Pass |
| Phone size (375 px) | Boards stack, no sideways scrolling, tapping places ships and fires | Pass |
| Console | No JavaScript errors | Pass |

**Not tested:** real phones (phone size was simulated in Chrome) and browsers other than Chrome.

**Bugs found:** none reproducible. One false alarm is explained in [BUGS.md](BUGS.md).
