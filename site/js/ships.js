// Ship pictures: one SVG per ship type, drawn pointing right (or down when vertical).
// No DOM code here, so it can be tested in Node.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BattleshipShapes = api;
})(typeof self !== "undefined" ? self : this, function () {
  const CODES = Object.freeze({ carrier: "CV", battleship: "BB", cruiser: "CA", submarine: "SS", destroyer: "DD" });
  const DETAIL = 'fill="rgba(20,24,30,0.4)"';

  // Hull with a rounded stern on the left and a pointed bow on the right.
  const pointed = (w, top, bottom) =>
    `<path d="M2,${top} H${w - 8} Q${w - 2},${top} ${w - 0.6},5 Q${w - 2},${bottom} ${w - 8},${bottom} H2 Q0.8,${bottom} 0.8,5 Q0.8,${top} 2,${top} Z" fill="currentColor"/>`;
  const turret = (cx, r) => `<circle cx="${cx}" cy="5" r="${r}" ${DETAIL}/>`;

  const DRAW = {
    carrier: (w) =>
      `<path d="M1,1.2 H${w - 7} L${w - 0.6},5 L${w - 7},8.8 H1 Z" fill="currentColor"/>` +
      `<path d="M3,5 H${w - 9}" stroke="rgba(255,255,255,0.75)" stroke-width="0.6" stroke-dasharray="2 1.5" fill="none"/>` +
      `<rect x="${w * 0.55}" y="1.8" width="6" height="2.2" rx="0.5" ${DETAIL}/>`,
    battleship: (w) =>
      pointed(w, 1.4, 8.6) + [5, 15, 25].filter((x) => x < w - 10).map((x) => turret(x, 1.8)).join(""),
    cruiser: (w) =>
      pointed(w, 1.8, 8.2) + turret(5, 1.6) + `<rect x="${w / 2 - 2.5}" y="3.4" width="5" height="3.2" rx="0.6" ${DETAIL}/>` + turret(w - 12, 1.6),
    submarine: (w) =>
      `<rect x="0.8" y="2.4" width="${w - 1.6}" height="5.2" rx="2.6" fill="currentColor"/>` +
      `<rect x="${w / 2 - 2.5}" y="3.3" width="5" height="3.4" rx="1.2" ${DETAIL}/>`,
    destroyer: (w) => pointed(w, 2.4, 7.6) + turret(5, 1.4),
  };

  function shipSvg(id, length, horizontal = true) {
    const draw = DRAW[id];
    if (!draw) throw new Error(`No picture for ship "${id}"`);
    const w = length * 10;
    const inner = horizontal ? draw(w) : `<g transform="translate(10 0) rotate(90)">${draw(w)}</g>`;
    const box = horizontal ? `0 0 ${w} 10` : `0 0 10 ${w}`;
    return `<svg class="hull" viewBox="${box}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${inner}</svg>`;
  }

  return { CODES, shipSvg };
});
