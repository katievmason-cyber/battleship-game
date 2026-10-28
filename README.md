# Battleship vs. AI

A browser Battleship game: you against a computer opponent. Drag your ships onto the board (or click to place them), then take turns firing. Plain HTML, CSS and JavaScript with no build step and no dependencies.

**Play it:** https://katievmason-cyber.github.io/battleship-game/

**Docs:** [plan](docs/PLAN.md) · [bug log](docs/BUGS.md) · [test results](docs/TESTING.md) · [debugging report](docs/DEBUGGING_REPORT.md)

## Run it locally
```
npm start          # serves site/ at http://localhost:8000 (needs Python 3)
```

## Tests
```
npm test           # Node 20+ built-in test runner, no installs needed
```

## How it's built and deployed
- `site/` is the whole website (HTML, CSS, JS). Nothing gets compiled.
- `tests/` holds automated tests, run by GitHub Actions on every pull request (`.github/workflows/ci.yml`).
- Every merge to `main` runs the tests again and, if they pass, publishes `site/` to GitHub Pages (`.github/workflows/deploy.yml`).

## The AI opponent
`site/js/ai.js` uses "hunt and target": it searches on a checkerboard pattern, fires next to any hit, then follows the line of a ship until it sinks. It only sees the results of its own shots. Run the simulator to see how well it plays:
```
node scripts/simulate.js 1000
```
