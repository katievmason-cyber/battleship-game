// Screen: draws the boards and turns clicks into calls to the rules engine.
// It holds no game rules of its own.
(function () {
  const B = window.Battleship;
  const { createAI } = window.BattleshipAI;
  const AI_DELAY_MS = 600;

  const $ = (id) => document.getElementById(id);
  const els = {
    status: $("status"),
    setup: $("setup"),
    shipList: $("ship-list"),
    rotate: $("rotate"),
    orientation: $("orientation"),
    random: $("random"),
    clear: $("clear"),
    start: $("start"),
    newGame: $("new-game"),
    playerBoard: $("player-board"),
    enemyBoard: $("enemy-board"),
    playerStats: $("player-stats"),
    aiStats: $("ai-stats"),
    playerFleet: $("player-fleet"),
    enemyFleet: $("enemy-fleet"),
    log: $("log"),
    overlay: $("game-over"),
    resultTitle: $("result-title"),
    resultDetail: $("result-detail"),
    playAgain: $("play-again"),
    viewBoard: $("view-board"),
  };

  let game;
  let ai;
  let selectedShipId;
  let horizontal;
  let hoverCell;
  let aiTimer = null;
  let stats;
  let lastShot;

  const cells = { player: [], enemy: [] };

  function buildBoard(container, side) {
    container.innerHTML = "";
    container.appendChild(document.createElement("span")).className = "label";
    for (let c = 0; c < B.SIZE; c++) {
      const span = container.appendChild(document.createElement("span"));
      span.className = "label";
      span.textContent = c + 1;
    }
    for (let r = 0; r < B.SIZE; r++) {
      const rowLabel = container.appendChild(document.createElement("span"));
      rowLabel.className = "label";
      rowLabel.textContent = String.fromCharCode(65 + r);
      cells[side][r] = [];
      for (let c = 0; c < B.SIZE; c++) {
        const btn = container.appendChild(document.createElement("button"));
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.row = r;
        btn.dataset.col = c;
        cells[side][r][c] = btn;
      }
    }
  }

  const cellFromEvent = (e) => {
    const btn = e.target.closest(".cell");
    return btn ? [Number(btn.dataset.row), Number(btn.dataset.col)] : null;
  };

  function setStatus(text) {
    els.status.textContent = text;
  }

  function addLog(text, who) {
    const li = document.createElement("li");
    li.textContent = text;
    li.className = who;
    els.log.prepend(li);
  }

  const shipName = (id) => B.FLEET.find((s) => s.id === id).name;
  const nextUnplacedShip = () => B.FLEET.find((def) => !game.player.ships.some((s) => s.id === def.id));

  // ---------- Setup phase ----------

  function selectShip(id) {
    selectedShipId = id;
    render();
  }

  function onPlayerBoardClick(e) {
    if (game.phase !== "setup") return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    const [r, c] = cell;
    const existing = game.player.occupied.get(B.key(r, c));
    if (existing) {
      B.removeShip(game.player, existing.id);
      selectedShipId = existing.id;
      horizontal = existing.cells.length < 2 || existing.cells[0][0] === existing.cells[1][0];
      setStatus(`Picked up your ${existing.name}. Click to place it again.`);
      render();
      return;
    }
    if (!selectedShipId) return;
    const placed = B.placeShip(game.player, selectedShipId, r, c, horizontal);
    if (!placed.ok) {
      const why = placed.reason === "overlap" ? "overlaps another ship" : "doesn't fit on the board there";
      setStatus(`Your ${shipName(selectedShipId)} ${why}. Try another square or rotate it.`);
      return;
    }
    afterPlacementChange();
  }

  function afterPlacementChange() {
    const next = nextUnplacedShip();
    selectedShipId = next ? next.id : null;
    if (next) setStatus(`Place your ${next.name} (${next.length} squares).`);
    else setStatus("Fleet ready. Press Start battle, or click a ship to move it.");
    render();
  }

  function rotate() {
    if (game.phase !== "setup") return;
    horizontal = !horizontal;
    render();
  }

  function randomFleet() {
    if (game.phase !== "setup") return;
    for (const ship of [...game.player.ships]) B.removeShip(game.player, ship.id);
    B.placeFleetRandomly(game.player);
    afterPlacementChange();
  }

  function clearFleet() {
    if (game.phase !== "setup") return;
    for (const ship of [...game.player.ships]) B.removeShip(game.player, ship.id);
    afterPlacementChange();
  }

  function startBattle() {
    if (!B.startBattle(game).ok) return;
    hoverCell = null;
    setStatus("Battle stations! Your turn: pick a square in Enemy waters.");
    render();
  }

  // ---------- Battle phase ----------

  function describe(outcome, whose) {
    if (outcome.result === "miss") return "miss";
    if (outcome.result === "hit") return "hit!";
    return `hit, and sunk ${whose} ${outcome.ship.name}!`;
  }

  function track(side, outcome) {
    stats[side].shots++;
    if (outcome.result !== "miss") stats[side].hits++;
  }

  function onEnemyBoardClick(e) {
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (game.phase === "setup") {
      setStatus("Place your fleet and press Start battle first.");
      return;
    }
    if (game.phase !== "player") return;
    const [r, c] = cell;
    const outcome = B.playerFire(game, r, c);
    if (outcome.result === "repeat") {
      setStatus(`You've already fired at ${B.label(r, c)}. Pick another square.`);
      return;
    }
    if (outcome.result === "not-your-turn" || outcome.result === "invalid") return;
    track("player", outcome);
    lastShot = { side: "enemy", r, c };
    const text = `You fired at ${B.label(r, c)}: ${describe(outcome, "their")}`;
    addLog(text, "player");
    render();
    if (outcome.gameOver) return endGame();
    setStatus(`${text} The computer is aiming…`);
    aiTimer = setTimeout(aiTurn, AI_DELAY_MS);
  }

  function aiTurn() {
    aiTimer = null;
    if (game.phase !== "ai") return;
    const [r, c] = ai.nextShot();
    const outcome = B.aiFire(game, r, c);
    ai.record(r, c, outcome);
    track("ai", outcome);
    lastShot = { side: "player", r, c };
    const text = `Computer fired at ${B.label(r, c)}: ${describe(outcome, "your")}`;
    addLog(text, "ai");
    render();
    if (outcome.gameOver) return endGame();
    setStatus(`${text} Your turn.`);
  }

  function accuracy(s) {
    return s.shots ? Math.round((100 * s.hits) / s.shots) : 0;
  }

  function endGame() {
    const won = game.winner === "player";
    els.resultTitle.textContent = won ? "You win!" : "The computer wins";
    els.resultDetail.textContent = won
      ? `You sank the enemy fleet in ${stats.player.shots} shots (${accuracy(stats.player)}% accuracy).`
      : `It sank your fleet in ${stats.ai.shots} shots. Its remaining ships are now shown.`;
    setStatus(`${els.resultTitle.textContent} Press New game to play again.`);
    render();
    els.overlay.hidden = false;
    els.playAgain.focus();
  }

  function newGame() {
    clearTimeout(aiTimer);
    aiTimer = null;
    game = B.createGame();
    ai = createAI();
    horizontal = true;
    hoverCell = null;
    lastShot = null;
    stats = { player: { shots: 0, hits: 0 }, ai: { shots: 0, hits: 0 } };
    els.log.innerHTML = "";
    els.overlay.hidden = true;
    selectedShipId = B.FLEET[0].id;
    setStatus(`Place your ships. Start with your Carrier (5 squares): click a square on Your fleet. Press R to rotate.`);
    render();
  }

  // ---------- Drawing ----------

  function previewCells() {
    if (game.phase !== "setup" || !hoverCell || !selectedShipId) return null;
    const length = B.FLEET.find((s) => s.id === selectedShipId).length;
    const ok = B.checkPlacement(game.player, selectedShipId, hoverCell[0], hoverCell[1], horizontal).ok;
    const list = B.shipCells(hoverCell[0], hoverCell[1], length, horizontal).filter(([r, c]) => B.inBounds(r, c));
    return { ok, keys: new Set(list.map(([r, c]) => B.key(r, c))) };
  }

  function drawCell(btn, { ship, shot, sunk, revealed, preview, last, label, disabled }) {
    btn.className = "cell";
    if (ship) btn.classList.add("ship");
    if (revealed) btn.classList.add("revealed");
    if (shot === "miss") btn.classList.add("miss");
    if (shot === "hit") btn.classList.add(sunk ? "sunk" : "hit");
    if (preview) btn.classList.add(preview);
    if (last) btn.classList.add("last-shot");
    btn.textContent = shot === "miss" ? "•" : shot === "hit" ? "✕" : "";
    btn.setAttribute("aria-label", label);
    btn.disabled = disabled;
  }

  function cellLabel(r, c, parts) {
    return [B.label(r, c), ...parts.filter(Boolean)].join(", ");
  }

  function render() {
    const setup = game.phase === "setup";
    const over = game.phase === "over";
    const preview = previewCells();

    for (let r = 0; r < B.SIZE; r++) {
      for (let c = 0; c < B.SIZE; c++) {
        const k = B.key(r, c);

        const mine = game.player.occupied.get(k);
        const myShot = game.player.shots.get(k);
        const mySunk = mine && mine.hits.size === mine.length;
        drawCell(cells.player[r][c], {
          ship: Boolean(mine),
          shot: myShot,
          sunk: mySunk,
          preview: preview && preview.keys.has(k) ? (preview.ok ? "preview-ok" : "preview-bad") : null,
          last: lastShot && lastShot.side === "player" && lastShot.r === r && lastShot.c === c,
          label: cellLabel(r, c, [mine && `your ${mine.name}`, myShot && (mySunk ? "sunk" : myShot)]),
          disabled: !setup,
        });

        const theirs = game.enemy.occupied.get(k);
        const theirShot = game.enemy.shots.get(k);
        const theirSunk = theirs && theirs.hits.size === theirs.length;
        drawCell(cells.enemy[r][c], {
          ship: false,
          shot: theirShot,
          sunk: theirSunk,
          revealed: Boolean(theirs) && (theirSunk || over),
          last: lastShot && lastShot.side === "enemy" && lastShot.r === r && lastShot.c === c,
          label: cellLabel(r, c, [theirShot ? (theirSunk ? `sunk ${theirs.name}` : theirShot) : "not fired at"]),
          disabled: game.phase !== "player" && !setup,
        });
      }
    }

    els.playerBoard.classList.toggle("placing", setup);
    els.playerBoard.classList.toggle("inactive", game.phase === "player");
    els.enemyBoard.classList.toggle("targetable", game.phase === "player");
    els.enemyBoard.classList.toggle("inactive", setup || game.phase === "ai");

    els.setup.hidden = !setup;
    els.orientation.textContent = horizontal ? "Horizontal" : "Vertical";
    els.start.disabled = !B.isFleetPlaced(game.player);
    els.shipList.innerHTML = "";
    for (const def of B.FLEET) {
      const li = els.shipList.appendChild(document.createElement("li"));
      const btn = li.appendChild(document.createElement("button"));
      const placed = game.player.ships.some((s) => s.id === def.id);
      btn.type = "button";
      btn.textContent = `${def.name} (${def.length})`;
      btn.classList.toggle("placed", placed);
      btn.setAttribute("aria-pressed", String(def.id === selectedShipId));
      btn.addEventListener("click", () => {
        if (placed) B.removeShip(game.player, def.id);
        selectShip(def.id);
        setStatus(`Place your ${def.name} (${def.length} squares).`);
      });
    }

    drawFleet(els.playerFleet, game.player);
    drawFleet(els.enemyFleet, game.enemy);
    els.playerStats.textContent = `Your shots: ${stats.player.shots} · hits: ${stats.player.hits} · accuracy: ${accuracy(stats.player)}%`;
    els.aiStats.textContent = `Computer shots: ${stats.ai.shots} · hits: ${stats.ai.hits} · accuracy: ${accuracy(stats.ai)}%`;
  }

  function drawFleet(list, board) {
    list.innerHTML = "";
    for (const def of B.FLEET) {
      const ship = board.ships.find((s) => s.id === def.id);
      const sunk = ship && ship.hits.size === ship.length;
      const li = list.appendChild(document.createElement("li"));
      li.className = sunk ? "sunk" : "";
      li.innerHTML = `${def.name} <span class="pips" aria-hidden="true">${"■".repeat(def.length)}</span>`;
      if (sunk) li.append(" (sunk)");
    }
  }

  // ---------- Wiring ----------

  buildBoard(els.playerBoard, "player");
  buildBoard(els.enemyBoard, "enemy");

  els.playerBoard.addEventListener("click", onPlayerBoardClick);
  els.enemyBoard.addEventListener("click", onEnemyBoardClick);
  els.playerBoard.addEventListener("mouseover", (e) => {
    const cell = cellFromEvent(e);
    if (!cell || game.phase !== "setup") return;
    hoverCell = cell;
    render();
  });
  els.playerBoard.addEventListener("mouseleave", () => {
    hoverCell = null;
    if (game.phase === "setup") render();
  });
  els.rotate.addEventListener("click", rotate);
  els.random.addEventListener("click", randomFleet);
  els.clear.addEventListener("click", clearFleet);
  els.start.addEventListener("click", startBattle);
  els.newGame.addEventListener("click", newGame);
  els.playAgain.addEventListener("click", newGame);
  els.viewBoard.addEventListener("click", () => {
    els.overlay.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) rotate();
    if (e.key === "Escape") els.overlay.hidden = true;
  });

  newGame();
})();
