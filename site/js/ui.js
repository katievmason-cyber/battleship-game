// Screen: draws the boards and turns clicks into calls to the rules engine.
// It holds no game rules of its own.
(function () {
  const B = window.Battleship;
  const { createAI } = window.BattleshipAI;
  const S = window.BattleshipShapes;
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
  let drag = null;
  let suppressClick = false;

  const cells = { player: [], enemy: [] };

  function buildBoard(container, side) {
    // Every item gets an explicit grid position so ship pictures can sit underneath the cells.
    const put = (el, row, col) => {
      el.style.gridRow = String(row + 1);
      el.style.gridColumn = String(col + 1);
      return el;
    };
    container.innerHTML = "";
    put(container.appendChild(document.createElement("span")), 0, 0).className = "label";
    for (let c = 0; c < B.SIZE; c++) {
      const span = put(container.appendChild(document.createElement("span")), 0, c + 1);
      span.className = "label";
      span.textContent = c + 1;
    }
    for (let r = 0; r < B.SIZE; r++) {
      const rowLabel = put(container.appendChild(document.createElement("span")), r + 1, 0);
      rowLabel.className = "label";
      rowLabel.textContent = String.fromCharCode(65 + r);
      cells[side][r] = [];
      for (let c = 0; c < B.SIZE; c++) {
        const btn = put(container.appendChild(document.createElement("button")), r + 1, c + 1);
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

  const shipDef = (id) => B.FLEET.find((s) => s.id === id);
  const shipName = (id) => shipDef(id).name;
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
      horizontal = B.isHorizontal(existing);
      setStatus(`Picked up your ${existing.name}. Click a square to place it again.`);
      render();
      return;
    }
    if (!selectedShipId) return;
    const placed = B.placeShip(game.player, selectedShipId, r, c, horizontal);
    if (!placed.ok) {
      setStatus(`Your ${shipName(selectedShipId)} ${whyNot(placed.reason)}. Try another square or rotate it.`);
      return;
    }
    afterPlacementChange();
  }

  const whyNot = (reason) => (reason === "overlap" ? "overlaps another ship" : "doesn't fit on the board there");

  function afterPlacementChange() {
    const next = nextUnplacedShip();
    selectedShipId = next ? next.id : null;
    if (next) setStatus(`Place your ${next.name} (${next.length} squares).`);
    else setStatus("Fleet ready. Press Start battle, or drag a ship to move it.");
    render();
  }

  function rotate() {
    if (game.phase !== "setup") return;
    horizontal = !horizontal;
    if (drag && drag.active) {
      drawGhost();
      moveDrag(drag.x, drag.y);
    } else render();
  }

  function randomFleet() {
    if (game.phase !== "setup") return;
    cancelDrag();
    for (const ship of [...game.player.ships]) B.removeShip(game.player, ship.id);
    B.placeFleetRandomly(game.player);
    afterPlacementChange();
  }

  function clearFleet() {
    if (game.phase !== "setup") return;
    cancelDrag();
    for (const ship of [...game.player.ships]) B.removeShip(game.player, ship.id);
    afterPlacementChange();
  }

  // ---------- Drag and drop (mouse and touch, via pointer events) ----------

  const DRAG_THRESHOLD_PX = 6;

  function onPalettePointerDown(e) {
    const btn = e.target.closest("button[data-ship]");
    if (!btn || game.phase !== "setup" || e.button > 0) return;
    const def = shipDef(btn.dataset.ship);
    const pic = btn.querySelector(".mini").getBoundingClientRect();
    const across = (e.clientX - pic.left) / pic.width;
    const grab = across >= 0 && across <= 1 ? Math.min(def.length - 1, Math.floor(across * def.length)) : 0;
    beginDrag(e, def.id, grab, false);
  }

  function onBoardPointerDown(e) {
    if (game.phase !== "setup" || e.button > 0) return;
    const cell = cellFromEvent(e);
    const ship = cell && game.player.occupied.get(B.key(cell[0], cell[1]));
    if (!ship) return;
    const grab = ship.cells.findIndex(([r, c]) => r === cell[0] && c === cell[1]);
    beginDrag(e, ship.id, grab, true);
  }

  function beginDrag(e, id, grab, fromBoard) {
    drag = { id, grab, fromBoard, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false, ghost: null };
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      selectedShipId = drag.id;
      if (drag.fromBoard) horizontal = B.isHorizontal(game.player.ships.find((s) => s.id === drag.id));
      drag.ghost = document.body.appendChild(document.createElement("div"));
      drag.ghost.className = "drag-ghost";
      drag.ghost.dataset.ship = drag.id;
      document.body.classList.add("dragging");
      drawGhost();
    }
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  }

  function boardPitch() {
    const cell = cells.player[0][0].getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(els.playerBoard).columnGap) || 0;
    return { size: cell.width, pitch: cell.width + gap };
  }

  function drawGhost() {
    const { length } = shipDef(drag.id);
    const { size, pitch } = boardPitch();
    const long = `${pitch * length - (pitch - size)}px`;
    drag.ghost.innerHTML = S.shipSvg(drag.id, length, horizontal);
    drag.ghost.style.width = horizontal ? long : `${size}px`;
    drag.ghost.style.height = horizontal ? `${size}px` : long;
  }

  function moveDrag(x, y) {
    drag.x = x;
    drag.y = y;
    const { pitch } = boardPitch();
    const along = (drag.grab + 0.5) * pitch;
    drag.ghost.style.left = `${x - (horizontal ? along : pitch / 2)}px`;
    drag.ghost.style.top = `${y - (horizontal ? pitch / 2 : along)}px`;
    const under = document.elementFromPoint(x, y);
    const btn = under && under.closest("#player-board .cell");
    if (btn) {
      const r = Number(btn.dataset.row);
      const c = Number(btn.dataset.col);
      hoverCell = horizontal ? [r, c - drag.grab] : [r - drag.grab, c];
    } else hoverCell = null;
    render();
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { id, active, fromBoard } = drag;
    const target = hoverCell;
    endDrag();
    if (!active) return; // a plain click: the click handlers deal with it
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    const name = shipName(id);
    if (!target) {
      setStatus(fromBoard ? `Your ${name} stayed where it was. Drop ships onto Your fleet.` : `Drop your ${name} onto the squares of Your fleet.`);
      return render();
    }
    const moved = B.moveShip(game.player, id, target[0], target[1], horizontal);
    if (moved.ok) return afterPlacementChange();
    setStatus(`Your ${name} ${whyNot(moved.reason)}${fromBoard ? ", so it stayed where it was" : ""}. Try another spot or rotate it (R).`);
    render();
  }

  function endDrag() {
    if (drag && drag.ghost) drag.ghost.remove();
    drag = null;
    hoverCell = null;
    document.body.classList.remove("dragging");
  }

  function cancelDrag() {
    if (!drag) return;
    const wasActive = drag.active;
    endDrag();
    if (wasActive && game.phase === "setup") render();
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
    endDrag();
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
    setStatus("Place your ships: drag each one onto Your fleet, or pick one and click a square. Press R to rotate.");
    render();
  }

  // ---------- Drawing ----------

  function previewCells() {
    if (game.phase !== "setup" || !hoverCell || !selectedShipId) return null;
    const { length } = shipDef(selectedShipId);
    const ok = B.checkMove(game.player, selectedShipId, hoverCell[0], hoverCell[1], horizontal).ok;
    const list = B.shipCells(hoverCell[0], hoverCell[1], length, horizontal).filter(([r, c]) => B.inBounds(r, c));
    return { ok, keys: new Set(list.map(([r, c]) => B.key(r, c))) };
  }

  function drawCell(btn, { ship, shot, sunk, preview, last, label, disabled }) {
    btn.className = "cell";
    if (ship) btn.classList.add("ship");
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
          ship: Boolean(theirs) && (theirSunk || over),
          shot: theirShot,
          sunk: theirSunk,
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
    drawShips(els.playerBoard, game.player.ships.map((ship) => ({ ship, ghost: drag && drag.active && drag.id === ship.id })));
    drawShips(
      els.enemyBoard,
      game.enemy.ships.filter((ship) => over || ship.hits.size === ship.length).map((ship) => ({ ship, ghost: ship.hits.size < ship.length })),
    );

    els.shipList.innerHTML = "";
    for (const def of B.FLEET) {
      const li = els.shipList.appendChild(document.createElement("li"));
      const btn = li.appendChild(document.createElement("button"));
      const placed = game.player.ships.some((s) => s.id === def.id);
      btn.type = "button";
      btn.dataset.ship = def.id;
      btn.innerHTML = `<span class="mini" style="--len:${def.length}">${S.shipSvg(def.id, def.length)}</span><span>${def.name} (${def.length})</span>`;
      btn.setAttribute("aria-label", `${def.name}, ${def.length} squares${placed ? ", placed" : ""}`);
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

  function drawShips(boardEl, list) {
    for (const old of boardEl.querySelectorAll(".ship-shape")) old.remove();
    for (const { ship, ghost } of list) {
      const across = B.isHorizontal(ship);
      const [r, c] = ship.cells[0];
      const el = document.createElement("div");
      el.className = "ship-shape";
      el.classList.toggle("ghost", Boolean(ghost));
      el.classList.toggle("sunk", ship.hits.size === ship.length);
      el.dataset.ship = ship.id;
      el.setAttribute("aria-hidden", "true");
      el.style.gridRow = `${r + 2} / span ${across ? 1 : ship.length}`;
      el.style.gridColumn = `${c + 2} / span ${across ? ship.length : 1}`;
      el.innerHTML = `${S.shipSvg(ship.id, ship.length, across)}<span class="code">${S.CODES[ship.id]}</span>`;
      boardEl.prepend(el);
    }
  }

  function drawFleet(list, board) {
    list.innerHTML = "";
    for (const def of B.FLEET) {
      const ship = board.ships.find((s) => s.id === def.id);
      const sunk = ship && ship.hits.size === ship.length;
      const li = list.appendChild(document.createElement("li"));
      li.className = sunk ? "sunk" : "";
      li.dataset.ship = def.id;
      li.innerHTML = `<span class="mini" style="--len:${def.length}">${S.shipSvg(def.id, def.length)}</span> ${def.name} <span class="code">${S.CODES[def.id]}</span>`;
      if (sunk) li.append(" (sunk)");
    }
  }

  // ---------- Wiring ----------

  buildBoard(els.playerBoard, "player");
  buildBoard(els.enemyBoard, "enemy");

  els.playerBoard.addEventListener("click", onPlayerBoardClick);
  els.enemyBoard.addEventListener("click", onEnemyBoardClick);
  els.shipList.addEventListener("pointerdown", onPalettePointerDown);
  els.playerBoard.addEventListener("pointerdown", onBoardPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", cancelDrag);
  document.addEventListener(
    "click",
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
  els.playerBoard.addEventListener("mouseover", (e) => {
    const cell = cellFromEvent(e);
    if (!cell || game.phase !== "setup" || drag) return;
    hoverCell = cell;
    render();
  });
  els.playerBoard.addEventListener("mouseleave", () => {
    if (drag) return;
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
    if (e.key === "Escape") {
      cancelDrag();
      els.overlay.hidden = true;
    }
  });

  newGame();
})();
