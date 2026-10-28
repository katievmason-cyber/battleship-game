// Rules engine ("the referee"): boards, ships, placement, shots, turns, winning.
// No DOM code here, so it runs unchanged in the browser and in Node tests.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Battleship = api;
})(typeof self !== "undefined" ? self : this, function () {
  const SIZE = 10;

  const FLEET = Object.freeze([
    { id: "carrier", name: "Carrier", length: 5 },
    { id: "battleship", name: "Battleship", length: 4 },
    { id: "cruiser", name: "Cruiser", length: 3 },
    { id: "submarine", name: "Submarine", length: 3 },
    { id: "destroyer", name: "Destroyer", length: 2 },
  ]);

  // Small seedable random number generator (mulberry32), so tests can replay
  // exactly the same "random" game every time.
  function createRng(seed = Date.now()) {
    let a = seed >>> 0;
    return function rng() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const key = (row, col) => `${row},${col}`;
  const inBounds = (row, col) =>
    Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < SIZE && col >= 0 && col < SIZE;

  // "A1" style label: letter = row, number = column.
  const label = (row, col) => `${String.fromCharCode(65 + row)}${col + 1}`;

  function shipCells(row, col, length, horizontal) {
    const cells = [];
    for (let i = 0; i < length; i++) {
      cells.push(horizontal ? [row, col + i] : [row + i, col]);
    }
    return cells;
  }

  function createBoard() {
    return { ships: [], occupied: new Map(), shots: new Map() };
  }

  function findShipDef(shipId) {
    return FLEET.find((s) => s.id === shipId);
  }

  // Returns { ok: true } or { ok: false, reason } without changing the board.
  function checkPlacement(board, shipId, row, col, horizontal) {
    const def = findShipDef(shipId);
    if (!def) return { ok: false, reason: "unknown-ship" };
    if (board.ships.some((s) => s.id === shipId)) return { ok: false, reason: "already-placed" };
    const cells = shipCells(row, col, def.length, horizontal);
    if (!cells.every(([r, c]) => inBounds(r, c))) return { ok: false, reason: "out-of-bounds" };
    if (cells.some(([r, c]) => board.occupied.has(key(r, c)))) return { ok: false, reason: "overlap" };
    return { ok: true, cells };
  }

  function placeShip(board, shipId, row, col, horizontal) {
    const check = checkPlacement(board, shipId, row, col, horizontal);
    if (!check.ok) return check;
    const def = findShipDef(shipId);
    const ship = { id: def.id, name: def.name, length: def.length, cells: check.cells, hits: new Set() };
    board.ships.push(ship);
    for (const [r, c] of ship.cells) board.occupied.set(key(r, c), ship);
    return { ok: true, ship };
  }

  function removeShip(board, shipId) {
    const index = board.ships.findIndex((s) => s.id === shipId);
    if (index === -1) return false;
    const [ship] = board.ships.splice(index, 1);
    for (const [r, c] of ship.cells) board.occupied.delete(key(r, c));
    return true;
  }

  const isHorizontal = (ship) => ship.cells.length < 2 || ship.cells[0][0] === ship.cells[1][0];

  // Like checkPlacement, but a ship that is already on the board may land on
  // its own current squares (e.g. dragging it one square along).
  function checkMove(board, shipId, row, col, horizontal) {
    const ship = board.ships.find((s) => s.id === shipId);
    if (!ship) return checkPlacement(board, shipId, row, col, horizontal);
    const cells = shipCells(row, col, ship.length, horizontal);
    if (!cells.every(([r, c]) => inBounds(r, c))) return { ok: false, reason: "out-of-bounds" };
    const blocked = cells.some(([r, c]) => {
      const other = board.occupied.get(key(r, c));
      return other && other.id !== shipId;
    });
    if (blocked) return { ok: false, reason: "overlap" };
    return { ok: true, cells };
  }

  // Moves (or first places) a ship. If the new spot is illegal the board is unchanged.
  // Only allowed before any shots: moving would lose the ship's recorded hits.
  function moveShip(board, shipId, row, col, horizontal) {
    if (board.shots.size > 0) return { ok: false, reason: "battle-started" };
    const check = checkMove(board, shipId, row, col, horizontal);
    if (!check.ok) return check;
    removeShip(board, shipId);
    return placeShip(board, shipId, row, col, horizontal);
  }

  function isFleetPlaced(board) {
    return FLEET.every((def) => board.ships.some((s) => s.id === def.id));
  }

  // Places every not-yet-placed ship at random. Lists every legal spot and picks
  // one, so it can never loop forever. If an earlier manual layout leaves no
  // room for a ship, it starts over with a clear board.
  function placeFleetRandomly(board, rng = Math.random) {
    for (let attempt = 0; attempt < 100; attempt++) {
      let stuck = false;
      for (const def of FLEET) {
        if (board.ships.some((s) => s.id === def.id)) continue;
        const options = [];
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            for (const horizontal of [true, false]) {
              if (checkPlacement(board, def.id, r, c, horizontal).ok) options.push([r, c, horizontal]);
            }
          }
        }
        if (options.length === 0) {
          stuck = true;
          break;
        }
        const [r, c, horizontal] = options[Math.floor(rng() * options.length)];
        placeShip(board, def.id, r, c, horizontal);
      }
      if (!stuck) return board;
      for (const ship of [...board.ships]) removeShip(board, ship.id);
    }
    throw new Error("Could not place fleet");
  }

  const isSunk = (ship) => ship.hits.size === ship.length;
  const allSunk = (board) => board.ships.length > 0 && board.ships.every(isSunk);

  // Result: { result: "miss" | "hit" | "sunk" | "repeat" | "invalid", ship? }
  function receiveShot(board, row, col) {
    if (!inBounds(row, col)) return { result: "invalid" };
    const k = key(row, col);
    if (board.shots.has(k)) return { result: "repeat" };
    const ship = board.occupied.get(k);
    if (!ship) {
      board.shots.set(k, "miss");
      return { result: "miss" };
    }
    ship.hits.add(k);
    board.shots.set(k, "hit");
    if (isSunk(ship)) return { result: "sunk", ship: { id: ship.id, name: ship.name, cells: ship.cells } };
    return { result: "hit" };
  }

  // A whole game: phases "setup" -> "player" <-> "ai" -> "over".
  function createGame({ rng = Math.random } = {}) {
    const enemy = createBoard();
    placeFleetRandomly(enemy, rng);
    return { phase: "setup", player: createBoard(), enemy, winner: null, rng };
  }

  function startBattle(game) {
    if (game.phase !== "setup") return { ok: false, reason: "wrong-phase" };
    if (!isFleetPlaced(game.player)) return { ok: false, reason: "fleet-incomplete" };
    game.phase = "player";
    return { ok: true };
  }

  // Shared turn logic. A "repeat" or "invalid" shot does not use up the turn.
  function fire(game, shooter, row, col) {
    if (game.phase !== shooter) return { result: "not-your-turn" };
    const target = shooter === "player" ? game.enemy : game.player;
    const outcome = receiveShot(target, row, col);
    if (outcome.result === "repeat" || outcome.result === "invalid") return outcome;
    if (allSunk(target)) {
      game.phase = "over";
      game.winner = shooter;
      outcome.gameOver = true;
    } else {
      game.phase = shooter === "player" ? "ai" : "player";
    }
    return outcome;
  }

  const playerFire = (game, row, col) => fire(game, "player", row, col);
  const aiFire = (game, row, col) => fire(game, "ai", row, col);

  return {
    SIZE,
    FLEET,
    createRng,
    key,
    inBounds,
    label,
    shipCells,
    createBoard,
    checkPlacement,
    placeShip,
    removeShip,
    isHorizontal,
    checkMove,
    moveShip,
    isFleetPlaced,
    placeFleetRandomly,
    receiveShot,
    allSunk,
    createGame,
    startBattle,
    playerFire,
    aiFire,
  };
});
