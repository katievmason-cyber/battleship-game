// Plays the AI against many random fleets and reports how many shots it needs.
// Usage: node scripts/simulate.js [games]
const B = require("../site/js/game.js");
const { createAI } = require("../site/js/ai.js");

function playOne(seed, makeShooter = (rng) => createAI({ rng })) {
  const rng = B.createRng(seed);
  const board = B.placeFleetRandomly(B.createBoard(), rng);
  const ai = makeShooter(rng);
  const fired = new Set();
  let shots = 0;
  while (!B.allSunk(board)) {
    const [r, c] = ai.nextShot();
    const k = B.key(r, c);
    if (fired.has(k)) throw new Error(`seed ${seed}: repeated shot at ${B.label(r, c)}`);
    if (!B.inBounds(r, c)) throw new Error(`seed ${seed}: shot off the board at ${r},${c}`);
    fired.add(k);
    const outcome = B.receiveShot(board, r, c);
    ai.record(r, c, outcome);
    shots++;
    if (shots > 100) throw new Error(`seed ${seed}: more than 100 shots`);
  }
  return shots;
}

function randomShooter(rng) {
  const cells = [];
  for (let r = 0; r < B.SIZE; r++) for (let c = 0; c < B.SIZE; c++) cells.push([r, c]);
  return {
    nextShot: () => cells.splice(Math.floor(rng() * cells.length), 1)[0],
    record() {},
  };
}

function simulate(games = 1000, makeShooter) {
  const results = [];
  for (let seed = 1; seed <= games; seed++) results.push(playOne(seed, makeShooter));
  results.sort((a, b) => a - b);
  const mean = results.reduce((a, b) => a + b, 0) / games;
  return { games, mean, min: results[0], median: results[Math.floor(games / 2)], max: results[games - 1] };
}

module.exports = { playOne, simulate, randomShooter };

if (require.main === module) {
  const games = Number(process.argv[2]) || 1000;
  const fmt = (s) => `mean ${s.mean.toFixed(1)}, median ${s.median}, best ${s.min}, worst ${s.max}`;
  console.log(`Hunt/target AI over ${games} games: ${fmt(simulate(games))}`);
  console.log(`Random guessing over ${games} games: ${fmt(simulate(games, randomShooter))}`);
}
