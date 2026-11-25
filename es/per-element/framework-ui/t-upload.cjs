const run = require('./lib.cjs');
run('upload.html', async ({ p, r, txt, st, stPoked, calls }) => {
  let s;
  r('closed dialog renders nothing', !(await p.$('[role=dialog]')));
  await p.click('#open'); await p.waitForTimeout(600);
  const d = await p.$('[role=dialog]');
  r('host open=true opens dialog (teleported)', !!d && /Upload from device/.test(await d.innerText()), d ? (await d.innerText()).replace(/\s+/g, ' ').slice(0, 120) : '');
  const fi = await p.$('input[type=file]');
  await fi.setInputFiles([{ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('aa') }, { name: 'big.txt', mimeType: 'text/plain', buffer: Buffer.alloc(5000, 1) }, { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('png') }]);
  await p.waitForTimeout(400);
  const dt = (await txt('[role=dialog]')).replace(/\s+/g, ' ');
  r('restrictions object prop enforced client-side (size + type)', /a\.txt/.test(dt) && /(too large|exceeds|larger|size)/i.test(dt) && /(not allowed|type)/i.test(dt), dt.slice(0, 300));
  await p.getByRole('dialog').getByRole('button', { name: 'Upload', exact: true }).click().catch((e) => console.log('  upload btn', e.message.slice(0, 60))); await p.waitForTimeout(1200);
  s = await stPoked();
  r('Upload -> default transport POST /api/method/upload_file', calls.some((c) => c.method === 'upload_file'), calls.map((c) => c.method).join(','));
  r('committed event with file_url, uploading true/false events', s.committed.includes('/files/a.txt') && s.uploading.includes(true) && s.uploading.includes(false), JSON.stringify(s));
  r('dialog closed after commit (update:open)', !s.open && !(await p.$('[role=dialog]')), JSON.stringify([s.open]));
  // AttachmentsList with transport function prop
  r('AttachmentsList empty state', /No attachments yet/.test(await txt('#c-al')));
  await p.click('#c-al button:has-text("Attach")'); await p.waitForTimeout(700);
  const fi2 = await p.$('#c-al input[type=file]');
  await p.evaluate(() => { window.__trayText = ''; new MutationObserver(() => { const t = document.getElementById('c-tray').innerText; if (t.length > window.__trayText.length) window.__trayText = t }).observe(document.getElementById('c-tray'), { subtree: true, childList: true, characterData: true }) });
  await fi2.setInputFiles({ name: 'b.md', mimeType: 'text/markdown', buffer: Buffer.from('# b') }); await p.waitForTimeout(300);
  await p.getByRole('dialog').getByRole('button', { name: 'Upload', exact: true }).click().catch(() => {}); await p.waitForTimeout(1200);
  s = await stPoked();
  r('AttachmentsList uses transport fn prop + v-model', (await p.evaluate(() => window.__tx)) === 1 && s.files.length === 1 && s.files[0].file_url === '/files/custom-b.md', JSON.stringify(s.files) + ' tx=' + (await p.evaluate(() => window.__tx)));
  r('AttachmentsList renders the file row', /b\.md/.test(await txt('#c-al')));
  const tray = await p.evaluate(() => window.__trayText);
  r('UploadTray shows the tray-mode batch (b.md)', /b\.md|upload/i.test(tray), JSON.stringify(tray.slice(0, 120)));
  await p.hover('#c-al a'); await p.click('#c-al button[aria-label=Remove]'); await p.waitForTimeout(300);
  s = await stPoked(); r('AttachmentsList remove -> v-model []', s.files.length === 0, JSON.stringify(s.files));
}, {
  wait: 1200, shot: 'shot-upload.png',
  api: (m) => (m === 'upload_file' ? { name: 'F1', file_name: 'a.txt', file_url: '/files/a.txt', is_private: 0 } : undefined),
});
