// Differential: same interactions on plain-Vue mounts (control.html#scenario).
const run = require('./lib.cjs');
const which = process.argv[2];
const tests = {
  radio: async ({ p, r, st }) => {
    await p.click('#r-a'); await p.waitForTimeout(100);
    const a = (await st()).color; const fa = await p.evaluate(() => document.activeElement.id);
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100);
    r('[vue control] radio click a then ArrowDown -> b', a === 'a' && (await st()).color === 'b', a + ' focus=' + fa + ' -> ' + (await st()).color);
  },
  date: async ({ p, r, st }) => {
    await p.click('#dp'); await p.waitForTimeout(300);
    await p.click('[role=gridcell][aria-label^="2024-03-20"]'); await p.waitForTimeout(300);
    await p.click('#dp'); await p.waitForTimeout(300);
    await p.click('#dp-preset'); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const v = await p.$eval('#dp', e => e.value);
    r('[vue control] date picker: model set from actions slot while open, input after Escape', v === '2024-12-25', 'model=' + (await st()).d + ' input=' + v);
  },
};
run('control.html#' + which, tests[which]);
