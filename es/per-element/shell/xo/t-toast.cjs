require('./lib.cjs').run('toast.html', async ({ p, r, wait, txt, vis, log }) => {
  await p.click('#btn-toast'); await wait(500);
  const t = await p.$$eval('[data-sonner-toast]', es => es.map(e => e.innerText.trim().replace(/\n/g, ' / ')));
  r('standalone es-toast-provider shows toast.error with action', t.length === 1 && t[0].includes('Failed') && t[0].includes('Retry'), JSON.stringify(t));
  r('error toast has an icon', !!(await p.$('[data-sonner-toast] [data-icon]')));
  await p.click('[data-sonner-toast] button:has-text("Retry")'); await wait(300);
  r('toast action onClick fires', (await log()).includes('retry'), await log());
  await p.click('#btn-danger'); await wait(400);
  const d = await p.$('[role=dialog], [role=alertdialog]');
  r('standalone es-dialogs renders dialog.danger()', !!d && (await d.innerText()).includes('Delete it?'), d && await d.innerText());
  await p.click('[role=dialog] button:has-text("Delete")'); await wait(400);
  r('danger confirm runs async onConfirm and closes', (await log()).includes('deleted') && !(await p.$('[role=dialog]')), await log());
  await p.click('#btn-danger'); await wait(400); await p.keyboard.press('Escape'); await wait(400);
  r('imperative dialog Escape closes', !(await p.$('[role=dialog]')));
});
