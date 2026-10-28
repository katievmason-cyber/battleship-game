// Computer opponent: "hunt and target".
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

  const key = (r, c) => `${r},${c}`;
  const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

  function createAI({ rng = Math.random } = {}) {
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

    function nextShot() {
      const hits = unresolvedHits();
      if (hits.length) {
        const line = lineTargets(hits);
        if (line.length) return pick(line);
        const near = neighbourTargets(hits);
        if (near.length) return pick(near);
      }
      const hunt = huntTargets();
      if (!hunt.length) throw new Error("No squares left to fire at");
      return pick(hunt);
    }

    // outcome: { result: "miss" | "hit" | "sunk", ship?: { cells } }
    function record(row, col, outcome) {
      if (outcome.result === "miss") known.set(key(row, col), "miss");
      else if (outcome.result === "hit") known.set(key(row, col), "hit");
      else if (outcome.result === "sunk") {
        known.set(key(row, col), "sunk");
        for (const [r, c] of outcome.ship.cells) known.set(key(r, c), "sunk");
      }
    }

    return { nextShot, record };
  }

  return { createAI };
});
