// Standalone PageHeader parts: PageHeaderTarget registry, PageHeaderBase, PageHeader in v-if, titles
require('./lib.cjs').run('parts.html', async ({ p, r, wait, txt, vis, rect, state, log, inside }) => {
  const ev = (f, a) => p.evaluate(f, a);
  r('page-header-base (no shell) teleports into the registered page-header-target', await inside('#phb-slot', '#tgt'), await ev(() => document.querySelector('#phb-slot')?.parentElement?.closest('[id]')?.id));
  r('page-header-base: $attrs (class) land on the teleported <header>', await p.$eval('#tgt header', h => h.className).then(c => c.includes('bg-surface-gray-2')).catch(() => false), await p.$eval('#tgt header', h => h.className).catch(() => 'none'));
  r('page-header-base anchor <span hidden> stays at declaration site', await ev(() => !!document.querySelector('#phb span[hidden]')));
  await p.click('#phb-btn button'); await wait(100);
  r('teleported base header slot stays live (click + interpolation)', (await txt('#phb-slot')) === 'Base header for Grace' && (await log()).includes('rename'), await txt('#phb-slot'));
  // header click (not on a control) scrolls the declaration-site scroll parent to top
  await ev(() => (document.querySelector('#decl').scrollTop = 200)); await wait(50);
  await p.click('#phb-slot'); await wait(700);
  const top = await ev(() => document.querySelector('#decl').scrollTop);
  r('clicking header background scrolls its declaration scroll parent to top', top === 0, top);
  r('second header (page-header in v-if) also teleported to the same target', await inside('#ph2t-slot', '#tgt') && (await txt('#ph2t-slot')) === 'Slot title Grace', await txt('#ph2t-slot'));
  r('page-header-title default slot overrides title', (await p.$eval('#ph2t span', s => s.className).catch(() => '')).includes('truncate'));
  const hdrsBefore = await ev(() => document.querySelectorAll('#tgt header').length);
  await p.click('#hide button'); await wait(300);
  const hdrsAfter = await ev(() => document.querySelectorAll('#tgt header').length);
  r('v-if false removes the teleported header', hdrsBefore === 2 && hdrsAfter === 1 && !(await p.$('#ph2t-slot')), `${hdrsBefore} -> ${hdrsAfter}`);
  r('standalone page-header-mobile-title (title prop)', (await txt('#sa-mt')) === 'Standalone mobile title', await txt('#sa-mt'));
  r('standalone page-header-title slot-only, interpolated', (await txt('#sa-t')) === 'Slot only Grace', await txt('#sa-t'));
  r('standalone back button: icon-only ghost button, aria-label "Back" (default label) + chevron', (await p.$eval('#sa-back button', b => b.getAttribute('aria-label')).catch(() => '')) === 'Back' && !!(await p.$('#sa-back button .lucide-chevron-left, #sa-back button svg')), await txt('#sa-back button'));
});
