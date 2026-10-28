const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../site/js/game.js");
const { createAI } = require("../site/js/ai.js");
const { simulate, randomShooter } = require("../scripts/simulate.js");

// Plays the AI against a fixed layout; fails on any repeated or off-board shot.
function playLayout(layout, seed) {
  const board = B.createBoard();
  for (const [id, r, c, h] of layout) assert.ok(B.placeShip(board, id, r, c, h).ok, `bad layout: ${id}`);
  const ai = createAI({ rng: B.createRng(seed) });
  const fired = new Set();
  let shots = 0;
  while (!B.allSunk(board)) {
    const [r, c] = ai.nextShot();
    assert.ok(B.inBounds(r, c), `seed ${seed}: off-board shot ${r},${c}`);
    assert.ok(!fired.has(B.key(r, c)), `seed ${seed}: repeated ${B.label(r, c)}`);
    fired.add(B.key(r, c));
    ai.record(r, c, B.receiveShot(board, r, c));
    assert.ok(++shots <= 100, `seed ${seed}: over 100 shots`);
  }
  return shots;
}

test("over 1,000 random games the AI never repeats a shot and averages 45-60 shots", () => {
  const stats = simulate(1000);
  assert.ok(stats.mean >= 45 && stats.mean <= 60, `mean ${stats.mean}`);
  assert.ok(stats.max < 100, `worst game took ${stats.max} shots`);
});

test("the AI clearly beats random guessing", () => {
  const ai = simulate(300);
  const random = simulate(300, randomShooter);
  assert.ok(ai.mean < random.mean - 30, `ai ${ai.mean} vs random ${random.mean}`);
});

test("finishes off touching, parallel ships", () => {
  const layout = [
    ["carrier", 0, 0, true],
    ["battleship", 1, 0, true],
    ["cruiser", 2, 0, true],
    ["submarine", 3, 0, true],
    ["destroyer", 4, 0, true],
  ];
  for (let seed = 1; seed <= 200; seed++) playLayout(layout, seed);
});

test("finishes off ships packed tightly into a corner", () => {
  const layout = [
    ["carrier", 9, 5, true], // bottom edge, cols 5-9
    ["battleship", 5, 9, false], // right edge, rows 5-8
    ["cruiser", 6, 6, true], // cols 6-8
    ["submarine", 6, 5, false], // rows 6-8
    ["destroyer", 8, 6, true], // cols 6-7
  ];
  for (let seed = 1; seed <= 200; seed++) playLayout(layout, seed);
});

test("handles ships lined up end to end on the same row", () => {
  const layout = [
    ["destroyer", 5, 0, true], // cols 0-1
    ["cruiser", 5, 2, true], // cols 2-4
    ["carrier", 5, 5, true], // cols 5-9
    ["battleship", 0, 0, false],
    ["submarine", 0, 9, false],
  ];
  for (let seed = 1; seed <= 200; seed++) playLayout(layout, seed);
});

test("after a single hit, the next shot is right next to it", () => {
  const ai = createAI({ rng: B.createRng(1) });
  ai.record(4, 4, { result: "hit" });
  const [r, c] = ai.nextShot();
  assert.equal(Math.abs(r - 4) + Math.abs(c - 4), 1);
});

test("after two hits in a row, it keeps to that line", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ai = createAI({ rng: B.createRng(seed) });
    ai.record(4, 4, { result: "hit" });
    ai.record(4, 5, { result: "hit" });
    const [r, c] = ai.nextShot();
    assert.equal(r, 4);
    assert.ok(c === 3 || c === 6, `went to ${r},${c}`);
  }
});

test("when one end of the line is water, it turns round and tries the other end", () => {
  const ai = createAI({ rng: B.createRng(1) });
  ai.record(4, 4, { result: "hit" });
  ai.record(4, 5, { result: "hit" });
  ai.record(4, 6, { result: "miss" });
  assert.deepEqual(ai.nextShot(), [4, 3]);
});

test("in hunt mode it only fires on one colour of the checkerboard", () => {
  const ai = createAI({ rng: B.createRng(9) });
  const colours = new Set();
  for (let i = 0; i < 50; i++) {
    const [r, c] = ai.nextShot();
    colours.add((r + c) % 2);
    ai.record(r, c, { result: "miss" });
  }
  assert.equal(colours.size, 1);
});

test("once the checkerboard is used up it still finds the remaining squares", () => {
  const ai = createAI({ rng: B.createRng(2) });
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const [r, c] = ai.nextShot();
    seen.add(B.key(r, c));
    ai.record(r, c, { result: "miss" });
  }
  assert.equal(seen.size, 100);
  assert.throws(() => ai.nextShot(), /No squares left/);
});

test("the AI only learns from shot results, never from the player's board", () => {
  const ai = createAI({ rng: B.createRng(1) });
  assert.deepEqual(Object.keys(ai).sort(), ["nextShot", "record"]);
  assert.equal(createAI.length, 0);
});
