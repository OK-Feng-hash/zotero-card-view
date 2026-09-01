const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../addon/content/modules/view-position.js"), "utf8"),
  context
);

function fixture() {
  const container = {
    scrollTop: 420,
    getBoundingClientRect: () => ({ top: 100, bottom: 700 })
  };
  const card = {
    getBoundingClientRect: () => ({ top: 180 - (container.scrollTop - 420), bottom: 360 - (container.scrollTop - 420) })
  };
  return { container, cards: new Map([[17, card]]) };
}

test("captures the selected visible card as a stable scroll anchor", () => {
  const { container, cards } = fixture();
  const state = context.CardViewViewPosition.capture(container, cards, [17]);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    top: 420,
    anchorID: 17,
    anchorOffset: 80
  });
});

test("restores both raw scroll position and selected-card viewport offset", () => {
  const { container, cards } = fixture();
  container.scrollTop = 0;
  const restored = context.CardViewViewPosition.restore(container, cards, {
    top: 420,
    anchorID: 17,
    anchorOffset: 80
  });
  assert.equal(restored, 420);
  assert.equal(container.scrollTop, 420);
});
