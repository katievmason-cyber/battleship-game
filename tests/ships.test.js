const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../site/js/game.js");
const S = require("../site/js/ships.js");

test("every ship has its own picture and a unique short code", () => {
  const codes = B.FLEET.map((def) => S.CODES[def.id]);
  assert.equal(new Set(codes).size, B.FLEET.length);
  const pictures = B.FLEET.map((def) => S.shipSvg(def.id, def.length));
  assert.equal(new Set(pictures).size, B.FLEET.length);
});

test("pictures are sized to the ship and turned when vertical", () => {
  for (const def of B.FLEET) {
    assert.match(S.shipSvg(def.id, def.length, true), new RegExp(`viewBox="0 0 ${def.length * 10} 10"`));
    const vertical = S.shipSvg(def.id, def.length, false);
    assert.match(vertical, new RegExp(`viewBox="0 0 10 ${def.length * 10}"`));
    assert.match(vertical, /rotate\(90\)/);
    assert.doesNotMatch(vertical, /NaN|undefined/);
  }
});

test("unknown ship type is an error, not a blank picture", () => {
  assert.throws(() => S.shipSvg("rowboat", 1));
});
