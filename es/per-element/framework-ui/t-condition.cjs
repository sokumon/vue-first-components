const run = require('./lib.cjs');
const opts = (p) => p.$$eval('[role=option]', (e) => e.filter((x) => x.offsetParent).map((x) => x.innerText.trim().replace(/\s+/g, ' ')));
run('condition.html', async ({ p, r, txt, st, stPoked }) => {
  let s;
  r('label + description props', /Conditions/.test(await txt('#c-cb')) && /When should this run/.test(await txt('#c-cb')));
  r('#empty slot rendered inside the empty button, bound', await p.evaluate(() => { const e = document.getElementById('cb-empty'); return !!e.closest('[data-slot=condition-empty]') && e.textContent.includes('(none)') }));
  await p.click('#c-cb [data-slot=condition-empty]'); await p.waitForTimeout(400);
  s = await st(); r('empty click -> v-model gets a blank condition', s.tree && s.tree.conditions.length === 1, JSON.stringify(s.tree));
  await p.click('#c-cb button:has-text("Field")'); await p.waitForTimeout(400);
  const fo = await opts(p);
  r('field picker lists meta fields (doctype prop)', fo.includes('Status') && fo.includes('Priority'), fo.join('|'));
  await p.click('[role=option]:has-text("Priority")'); await p.waitForTimeout(400);
  s = await st(); r('pick field -> condition.fieldname', s.tree.conditions[0].fieldname === 'priority', JSON.stringify(s.tree.conditions[0]));
  // value: Select fieldtype -> choose High
  const vbtn = await p.$$('#c-cb [data-slot*=value] button, #c-cb [data-slot*=value] input');
  if (vbtn[0]) { await vbtn[0].click(); await p.waitForTimeout(300); await p.click('[role=option]:has-text("High")').catch(() => {}); await p.waitForTimeout(400) }
  s = await st(); r('value -> v-model + update:expression (as displayed)', s.tree.conditions[0].value === 'High' && /High/.test(s.expr), JSON.stringify(s.tree.conditions[0]) + ' expr=' + s.expr);
  s = await stPoked(); r('value -> update:expression (after another petite flush)', /priority/.test(s.expr) && /High/.test(s.expr), 'expr=' + s.expr);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  console.log('  open overlays:', await p.$$eval('[role=dialog],[role=listbox],[role=menu]', (e) => e.length));
  await p.click('#c-cb button:has-text("Add Condition")'); await p.waitForTimeout(400);
  const mi = await p.$$eval('[role=menuitem]', (e) => e.map((x) => x.innerText.trim()));
  r('Add Condition dropdown (teleported menu) offers condition + group', mi.some((x) => /Add Condition$/.test(x)) && mi.some((x) => /Group/.test(x)), mi.join('|'));
  await p.click('[role=menuitem]:has-text("Add Condition") >> nth=0'); await p.waitForTimeout(400);
  s = await stPoked(); r('Add Condition appends', s.tree.conditions.length === 2, s.tree.conditions.length);
  // conjunction toggle (second row's "and" cell)
  await p.click('#c-cb button:has-text("and")'); await p.waitForTimeout(300);
  s = await stPoked(); r('conjunction switch -> or', s.tree.conjunction === 'or', s.tree.conjunction);
  // remove via actions menu
  const acts = await p.$$('#c-cb [data-slot=condition-actions] button');
  if (acts[1]) { await acts[1].click(); await p.waitForTimeout(300); const items = await p.$$eval('[role=menuitem]', (e) => e.map((x) => x.innerText.trim())); console.log('  actions menu:', items.join('|')); await p.click('[role=menuitem]:has-text("Remove"), [role=menuitem]:has-text("Delete")').catch(() => {}); await p.waitForTimeout(300) }
  s = await stPoked(); r('actions menu Remove', s.tree.conditions.length === 1, s.tree.conditions.length);
  // keyboard: Escape closes, focus stays inside
  // readonly instance with fields + labels object props
  const ro = (await txt('#c-cb-ro')).replace(/\s+/g, ' ');
  r('readonly builder draws fields prop + value, no add button', /Status/.test(ro) && /Open/.test(ro) && !/Add Condition/.test(ro), ro);
}, { wait: 1200, shot: 'shot-condition.png' });
