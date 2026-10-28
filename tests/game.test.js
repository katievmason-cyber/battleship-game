const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../site/js/game.js");

function fullFleet(board) {
  // One ship per row, all starting in column 0.
  B.FLEET.forEach((def, i) => assert.ok(B.placeShip(board, def.id, i * 2, 0, true).ok));
  return board;
}

function readyGame(seed = 1) {
  const game = B.createGame({ rng: B.createRng(seed) });
  fullFleet(game.player);
  assert.ok(B.startBattle(game).ok);
  return game;
}

test("fleet is the classic 5 ships, 17 squares", () => {
  assert.deepEqual(B.FLEET.map((s) => s.length), [5, 4, 3, 3, 2]);
  assert.equal(B.FLEET.reduce((n, s) => n + s.length, 0), 17);
});

test("labels use letter for row and number for column", () => {
  assert.equal(B.label(0, 0), "A1");
  assert.equal(B.label(9, 9), "J10");
});

test("ship can be placed on the board edge but not past it", () => {
  const board = B.createBoard();
  assert.ok(B.placeShip(board, "carrier", 0, 5, true).ok); // cols 5..9
  assert.equal(B.checkPlacement(board, "battleship", 0, 7, true).reason, "out-of-bounds");
  assert.equal(B.checkPlacement(board, "battleship", 7, 0, false).reason, "out-of-bounds"); // rows 7..10
  assert.ok(B.checkPlacement(board, "battleship", 6, 0, false).ok); // rows 6..9
});

test("rotating near the edge is checked again", () => {
  const board = B.createBoard();
  assert.ok(B.checkPlacement(board, "carrier", 8, 0, true).ok);
  assert.equal(B.checkPlacement(board, "carrier", 8, 0, false).reason, "out-of-bounds");
});

test("negative and non-integer coordinates are rejected", () => {
  const board = B.createBoard();
  assert.equal(B.checkPlacement(board, "destroyer", -1, 0, true).reason, "out-of-bounds");
  assert.equal(B.checkPlacement(board, "destroyer", 0.5, 0, true).reason, "out-of-bounds");
  assert.equal(B.receiveShot(board, 10, 0).result, "invalid");
  assert.equal(B.receiveShot(board, "3", 0).result, "invalid");
});

test("ships cannot overlap but may touch (classic rules)", () => {
  const board = B.createBoard();
  assert.ok(B.placeShip(board, "carrier", 0, 0, true).ok);
  assert.equal(B.checkPlacement(board, "destroyer", 0, 4, false).reason, "overlap");
  assert.ok(B.placeShip(board, "destroyer", 1, 0, true).ok); // directly below, touching
});

test("each ship can only be placed once; unknown ships are rejected", () => {
  const board = B.createBoard();
  assert.ok(B.placeShip(board, "destroyer", 0, 0, true).ok);
  assert.equal(B.placeShip(board, "destroyer", 5, 5, true).reason, "already-placed");
  assert.equal(B.placeShip(board, "rowboat", 5, 5, true).reason, "unknown-ship");
});

test("a removed ship frees its squares so it can be placed again", () => {
  const board = B.createBoard();
  B.placeShip(board, "carrier", 0, 0, true);
  assert.ok(B.removeShip(board, "carrier"));
  assert.ok(B.placeShip(board, "battleship", 0, 0, true).ok);
  assert.ok(B.placeShip(board, "carrier", 1, 0, true).ok);
});

test("random placement always produces a legal full fleet (500 seeds)", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const board = B.placeFleetRandomly(B.createBoard(), B.createRng(seed));
    assert.ok(B.isFleetPlaced(board));
    assert.equal(board.occupied.size, 17, `seed ${seed}: ships overlap`);
    for (const ship of board.ships) {
      for (const [r, c] of ship.cells) assert.ok(B.inBounds(r, c), `seed ${seed}: off board`);
    }
  }
});

test("random placement is repeatable with the same seed", () => {
  const a = B.placeFleetRandomly(B.createBoard(), B.createRng(42));
  const b = B.placeFleetRandomly(B.createBoard(), B.createRng(42));
  assert.deepEqual(a.ships.map((s) => s.cells), b.ships.map((s) => s.cells));
});

test("random placement keeps ships already placed by hand", () => {
  const board = B.createBoard();
  B.placeShip(board, "carrier", 9, 0, true);
  B.placeFleetRandomly(board, B.createRng(7));
  assert.ok(B.isFleetPlaced(board));
  assert.deepEqual(board.ships.find((s) => s.id === "carrier").cells, B.shipCells(9, 0, 5, true));
});

test("shots report miss, hit, then sunk with the ship's name", () => {
  const board = B.createBoard();
  B.placeShip(board, "destroyer", 0, 0, true);
  assert.equal(B.receiveShot(board, 5, 5).result, "miss");
  assert.equal(B.receiveShot(board, 0, 0).result, "hit");
  const sunk = B.receiveShot(board, 0, 1);
  assert.equal(sunk.result, "sunk");
  assert.equal(sunk.ship.name, "Destroyer");
  assert.ok(B.allSunk(board));
});

test("firing at the same square twice is a repeat and changes nothing", () => {
  const board = B.createBoard();
  B.placeShip(board, "destroyer", 0, 0, true);
  B.receiveShot(board, 0, 0);
  assert.equal(B.receiveShot(board, 0, 0).result, "repeat");
  assert.equal(board.ships[0].hits.size, 1);
  assert.equal(B.receiveShot(board, 3, 3).result, "miss");
  assert.equal(B.receiveShot(board, 3, 3).result, "repeat");
});

test("an empty board is not 'all sunk'", () => {
  assert.equal(B.allSunk(B.createBoard()), false);
});

test("battle cannot start until the whole fleet is placed", () => {
  const game = B.createGame({ rng: B.createRng(1) });
  assert.equal(B.startBattle(game).reason, "fleet-incomplete");
  assert.equal(B.playerFire(game, 0, 0).result, "not-your-turn");
  fullFleet(game.player);
  assert.ok(B.startBattle(game).ok);
  assert.equal(B.startBattle(game).reason, "wrong-phase");
});

test("the computer's fleet is placed for it at the start", () => {
  const game = B.createGame({ rng: B.createRng(3) });
  assert.ok(B.isFleetPlaced(game.enemy));
});

test("turns alternate, even after a hit", () => {
  const game = readyGame();
  const [r, c] = game.enemy.ships[0].cells[0];
  assert.equal(B.playerFire(game, r, c).result, "hit");
  assert.equal(game.phase, "ai");
  assert.equal(B.playerFire(game, 0, 0).result, "not-your-turn");
  B.aiFire(game, 9, 9);
  assert.equal(game.phase, "player");
  assert.equal(B.aiFire(game, 9, 8).result, "not-your-turn");
});

test("a repeat or off-board shot does not use up your turn", () => {
  const game = readyGame();
  B.playerFire(game, 0, 0);
  B.aiFire(game, 9, 9);
  assert.equal(B.playerFire(game, 0, 0).result, "repeat");
  assert.equal(B.playerFire(game, -1, 0).result, "invalid");
  assert.equal(game.phase, "player");
});

test("sinking the last ship ends the game at once, and nobody can fire after", () => {
  const game = readyGame(5);
  const targets = game.enemy.ships.flatMap((s) => s.cells);
  const aiShots = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (!game.player.occupied.has(B.key(r, c))) aiShots.push([r, c]);
  let last;
  for (const [r, c] of targets) {
    last = B.playerFire(game, r, c);
    if (game.phase === "ai") B.aiFire(game, ...aiShots.shift());
  }
  assert.equal(last.result, "sunk");
  assert.equal(last.gameOver, true);
  assert.equal(game.phase, "over");
  assert.equal(game.winner, "player");
  assert.equal(B.aiFire(game, 0, 0).result, "not-your-turn");
  assert.equal(B.playerFire(game, 0, 0).result, "not-your-turn");
});

test("the computer can win too", () => {
  const game = readyGame(6);
  const playerCells = game.player.ships.flatMap((s) => s.cells);
  const misses = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (!game.enemy.occupied.has(B.key(r, c))) misses.push([r, c]);
  for (const [r, c] of playerCells) {
    B.playerFire(game, ...misses.shift());
    B.aiFire(game, r, c);
  }
  assert.equal(game.winner, "ai");
  assert.equal(game.phase, "over");
});

test("moving a ship along onto its own squares is allowed", () => {
  const board = B.createBoard();
  B.placeShip(board, "carrier", 0, 0, true); // A1..A5
  assert.ok(B.moveShip(board, "carrier", 0, 1, true).ok); // A2..A6 overlaps its old A2..A5
  assert.equal(board.occupied.has(B.key(0, 0)), false);
  assert.equal(board.occupied.get(B.key(0, 5)).id, "carrier");
  assert.equal(board.ships.length, 1);
});

test("a ship can be rotated in place", () => {
  const board = B.createBoard();
  B.placeShip(board, "cruiser", 4, 4, true);
  assert.ok(B.moveShip(board, "cruiser", 4, 4, false).ok);
  assert.equal(B.isHorizontal(board.ships[0]), false);
  assert.deepEqual(board.ships[0].cells, [[4, 4], [5, 4], [6, 4]]);
});

test("an illegal move leaves the ship where it was", () => {
  const board = B.createBoard();
  B.placeShip(board, "carrier", 0, 0, true);
  B.placeShip(board, "destroyer", 2, 0, true);
  const before = board.ships.find((s) => s.id === "destroyer").cells;
  assert.equal(B.moveShip(board, "destroyer", 0, 3, true).reason, "overlap");
  assert.equal(B.moveShip(board, "destroyer", 2, 9, true).reason, "out-of-bounds");
  assert.deepEqual(board.ships.find((s) => s.id === "destroyer").cells, before);
  assert.equal(board.occupied.size, 7);
});

test("moveShip places a ship that isn't on the board yet", () => {
  const board = B.createBoard();
  assert.ok(B.moveShip(board, "submarine", 9, 7, true).ok);
  assert.equal(B.checkMove(board, "battleship", 9, 6, true).reason, "overlap");
});
