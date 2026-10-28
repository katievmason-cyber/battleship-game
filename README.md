# Battleship vs. AI

A browser Battleship game: you against a computer opponent. Plain HTML, CSS and JavaScript with no build step and no dependencies.

**Status:** under construction. See [docs/PLAN.md](docs/PLAN.md) for the plan and [docs/BUGS.md](docs/BUGS.md) for the bug log.

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
