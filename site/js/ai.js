// Computer opponent, with three difficulty levels:
//   easy   - fires at random and only sometimes follows up a hit.
//   medium - "hunt and target": checkerboard search, then finishes off hits.
//   hard   - counts every way the remaining ships could still fit and fires
//            at the square most likely to hold a ship.
// It is only ever told what a human would know: the result of each of its own
// shots, plus the squares of a ship once it is sunk (sunk ships are shown to
// both players). It never sees the player's board.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BattleshipAI = api;
})(typeof self !== "undefined" ? self : this, function () {
  const SIZE = 10;
  const DIRECTIONS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  const LEVELS = Object.freeze(["easy", "medium", "hard"]);
  const DEFAULT_LEVEL = "medium";
  const FLEET_LENGTHS = Object.freeze([5, 4, 3, 3, 2]);
  const EASY_FOLLOW_UP = 0.3;

  const key = (r, c) => `${r},${c}`;
  const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

  function createAI({ rng = Math.random, level = DEFAULT_LEVEL, shipLengths = FLEET_LENGTHS } = {}) {
    if (!LEVELS.includes(level)) throw new Error(`Unknown difficulty: ${level}`);
    const afloat = [...shipLengths];
    const known = new Map(); // key -> "miss" | "hit" | "sunk"
    const parity = rng() < 0.5 ? 0 : 1;

    const isUnknown = (r, c) => inBounds(r, c) && !known.has(key(r, c));
    const isHit = (r, c) => known.get(key(r, c)) === "hit";
    const pick = (cells) => cells[Math.floor(rng() * cells.length)];

    function unresolvedHits() {
      const hits = [];
      for (const [k, v] of known) if (v === "hit") hits.push(k.split(",").map(Number));
      return hits;
    }

    // Two or more hits in a row: keep firing along that line, at either end.
    function lineTargets(hits) {
      for (const [r, c] of hits) {
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ]) {
          if (!isHit(r + dr, c + dc)) continue;
          const ends = [];
          for (const sign of [1, -1]) {
            let rr = r;
            let cc = c;
            while (isHit(rr + sign * dr, cc + sign * dc)) {
              rr += sign * dr;
              cc += sign * dc;
            }
            rr += sign * dr;
            cc += sign * dc;
            if (isUnknown(rr, cc)) ends.push([rr, cc]);
          }
          if (ends.length) return ends;
        }
      }
      return [];
    }

    // A single hit (or a line that is blocked at both ends, which means
    // touching ships): try the squares directly next to any unresolved hit.
    function neighbourTargets(hits) {
      for (const [r, c] of hits) {
        const options = DIRECTIONS.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) => isUnknown(rr, cc));
        if (options.length) return options;
      }
      return [];
    }

    function huntTargets() {
      const checkerboard = [];
      const rest = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (!isUnknown(r, c)) continue;
          ((r + c) % 2 === parity ? checkerboard : rest).push([r, c]);
        }
      }
      return checkerboard.length ? checkerboard : rest;
    }

    function anyUnknown() {
      const cells = [];
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (isUnknown(r, c)) cells.push([r, c]);
      return cells;
    }

    function followUp(hits) {
      if (!hits.length) return [];
      const line = lineTargets(hits);
      return line.length ? line : neighbourTargets(hits);
    }

    // Scores each unknown square by how many placements of the ships still
    // afloat would cover it. While a ship is damaged, only placements through
    // those hits count, weighted heavily by how many hits they explain.
    function likeliestTargets(hits) {
      const score = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
      for (const length of afloat) {
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            for (const [dr, dc] of [
              [0, 1],
              [1, 0],
            ]) {
              const cells = [];
              let covered = 0;
              let fits = true;
              for (let i = 0; i < length && fits; i++) {
                const rr = r + i * dr;
                const cc = c + i * dc;
                const state = inBounds(rr, cc) ? known.get(key(rr, cc)) : "off";
                if (state === "hit") covered++;
                else if (state) fits = false;
                else cells.push([rr, cc]);
              }
              if (!fits || (hits.length && !covered)) continue;
              const weight = hits.length ? 50 ** covered : 1;
              for (const [rr, cc] of cells) score[rr][cc] += weight;
            }
          }
        }
      }
      let best = 0;
      let targets = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (score[r][c] > best) {
            best = score[r][c];
            targets = [];
          }
          if (best > 0 && score[r][c] === best) targets.push([r, c]);
        }
      }
      return targets;
    }

    function candidates() {
      const hits = unresolvedHits();
      if (level === "easy") {
        const target = rng() < EASY_FOLLOW_UP ? followUp(hits) : [];
        return target.length ? target : anyUnknown();
      }
      if (level === "hard") {
        const likely = likeliestTargets(hits);
        if (likely.length) return likely;
      }
      const target = followUp(hits);
      return target.length ? target : huntTargets();
    }

    function nextShot() {
      const options = candidates();
      if (!options.length) throw new Error("No squares left to fire at");
      return pick(options);
    }

    // outcome: { result: "miss" | "hit" | "sunk", ship?: { cells } }
    function record(row, col, outcome) {
      if (outcome.result === "miss") known.set(key(row, col), "miss");
      else if (outcome.result === "hit") known.set(key(row, col), "hit");
      else if (outcome.result === "sunk") {
        known.set(key(row, col), "sunk");
        for (const [r, c] of outcome.ship.cells) known.set(key(r, c), "sunk");
        const i = afloat.indexOf(outcome.ship.cells.length);
        if (i !== -1) afloat.splice(i, 1);
      }
    }

    return { level, nextShot, record };
  }

  return { LEVELS, DEFAULT_LEVEL, createAI };
});
