const run = require('./lib.cjs');
run('timeline.html', async ({ p, r, txt, st, stPoked }) => {
  let s;
  const types = await p.$$eval('#c-tl [data-type]', (e) => e.map((x) => x.dataset.type).join(','));
  r('timeline renders every activity type in order', types === 'log,version,comment,email,attachment_log', types);
  const tl = (await txt('#c-tl')).replace(/\s+/g, ' ');
  r('timeline rows show content', /created this/.test(tl) && /Open → Closed/.test(tl) && /Looks good/.test(tl) && /spec\.pdf/.test(tl), tl.slice(0, 300));
  r('#icon-log named slot lands in the log row gutter', await p.evaluate(() => { const i = document.querySelector('#c-tl .logicon'); return !!i && !!i.closest('.activity') && i.closest('.activity').querySelector('[data-type=log]') !== null }));
  await p.click('#c-tl button:has-text("Older activity")'); await p.waitForTimeout(200);
  s = await stPoked(); r('paginate.fetchNextPage fn prop called by Load More', s.more === 1, s.more);
  r('#empty slot bound + reactive', /Quiet here \(1\)/.test(await txt('#c-tl-empty')), await txt('#c-tl-empty'));
  r('exposed scrollToLatest/scrollToRow reachable on element', await p.evaluate(() => { const el = document.getElementById('c-tl'); return typeof el.scrollToLatest === 'function' && typeof el.scrollToRow === 'function' }), await p.evaluate(() => { const el = document.getElementById('c-tl'); return typeof el.scrollToLatest + '/' + (el._instance && el._instance.exposed ? Object.keys(el._instance.exposed).join(',') + ' exposedProxyHas=' + typeof el._instance.exposed.scrollToLatest : 'no exposed') }));
  const tcm = await p.$$eval('#c-tl-tpl .tplcomment', (e) => e.map((x) => x.textContent));
  r('scoped #item-comment <template> gets {activity}', tcm.length === 1 && tcm[0] === 'Comment c1 by Ada Lovelace', JSON.stringify(tcm));
  r('TimelineContainer default slot', /container child 1/.test(await txt('#c-tc')) && await p.evaluate(() => document.getElementById('tc-child').closest('#c-tc') !== null));
  // CommentItem edit flow
  r('CommentItem actions slot visible', await p.isVisible('#edit-btn'));
  await p.click('#edit-btn'); await p.waitForTimeout(500);
  r('CommentItem editable -> Save/Discard', /Save/.test(await txt('#c-comment')) && /Discard/.test(await txt('#c-comment')), await txt('#c-comment'));
  const ed = await p.$('#c-comment [contenteditable=true]');
  r('CommentItem editor becomes contenteditable', !!ed);
  if (ed) { await ed.click(); await p.keyboard.press('Control+End'); await p.keyboard.type(' indeed'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(300) }
  s = await stPoked(); r('Ctrl+Enter -> save event with edited html', /indeed/.test(s.saved) && s.editing === false, JSON.stringify(s.saved));
  await p.click('#edit-btn'); await p.waitForTimeout(300); await p.click('#c-comment button:has-text("Discard")'); await p.waitForTimeout(300);
  s = await stPoked(); r('Discard -> discard event', s.discards === 1 && s.editing === false, JSON.stringify(s));
  // EmailItem
  const em = (await txt('#c-email')).replace(/\s+/g, ' ');
  r('EmailItem header + footer slot bound', /Re: bug/.test(em) && /Reply to ada@example.com/.test(em), em);
  r('EmailItem body content visible', /Email body here/.test(em + (await p.$eval('#c-email', (e) => e.innerHTML))), em);
  r('LogItem / VersionItem standalone', /created this/.test(await txt('#c-log')) && /Open\s*→\s*Closed/.test(await txt('#c-version')), (await txt('#c-log')) + ' / ' + (await txt('#c-version')));
  // AttachmentChip preview dialog (markdown fetched from /files/readme.md)
  await p.click('#c-chip button'); await p.waitForTimeout(800);
  const d = await p.$('[role=dialog]');
  r('AttachmentChip opens preview dialog with fetched markdown', !!d && /Hello from readme/.test(await d.innerText()), d ? (await d.innerText()).slice(0, 120) : 'no dialog');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  r('Escape closes preview', !(await p.$('[role=dialog]')));
}, { wait: 1200, shot: 'shot-timeline.png' });
