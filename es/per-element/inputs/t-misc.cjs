const path = require('path'), fs = require('fs');
const small = path.join(__dirname, 'tmp-small.txt'), big = path.join(__dirname, 'tmp-big.txt');
fs.writeFileSync(small, 'hi'); fs.writeFileSync(big, 'x'.repeat(100));
require('./lib.cjs')('misc.html', async ({ p, r, txt, st }) => {
  const W = (ms = 250) => p.waitForTimeout(ms);
  const ev = (f, a) => p.evaluate(f, a);
  const reqs = [];
  await p.route('http://upload.test/**', async (route) => {
    reqs.push(route.request().postData()?.length || 0);
    await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'content-type': 'application/json' }, body: JSON.stringify({ message: { file_url: '/files/small.txt', name: 'F-1' } }) });
  });
  // ---- FileUploader default UI
  r('file-uploader default Upload button + accept from array prop', (await txt('#fu button')) === 'Upload File' && (await p.$eval('#fu input[type=file]', e => e.accept)) === '.txt,.png');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#fu button')]);
  await fc.setFiles(small); await W(800);
  r('file-uploader uploads (XHR to upload-endpoint) and emits success with data', reqs.length === 1 && (await st()).uploaded?.file_url === '/files/small.txt', JSON.stringify(await st()) + ' reqs=' + reqs.length);
  r('file-uploader data-state=success', (await p.$eval('#fu [data-slot=root]', e => e.dataset.state)) === 'success');
  // validateFile function prop
  await p.setInputFiles('#fu-val input[type=file]', big); await W(300);
  r('validate-file fn prop -> failure event + error message', (await st()).failed.includes('Too big') && (await txt('#fu-val')).includes('Too big'), JSON.stringify(await st()) + ' / ' + await txt('#fu-val'));
  // custom slot
  r('custom default slot replaces Upload button, stays reactive', (await txt('#fu-slot')) === 'Attach for Ada' && !(await p.$('#fu-slot button:has-text("Upload File")')), await txt('#fu-slot'));
  const [fc2] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), p.click('#fu-slot-btn')]);
  r('custom slot opens file chooser via host-side input lookup', !!fc2);
  if (fc2) { await fc2.setFiles(small); await W(800); }
  r('custom slot upload emits success', (await st()).up2?.name === 'F-1', JSON.stringify((await st()).up2));
  // ---- FormControl
  r('form-control label + description render', (await txt('#fc-text')).includes('Text') && (await txt('#fc-text')).includes('fc desc'), await txt('#fc-text'));
  r('form-control text: model-value reaches input', (await p.$eval('#fc-text input', e => e.value).catch(() => 'ERR')) === 'hello', await p.$eval('#fc-text input', e => e.value).catch(() => 'ERR'));
  r('form-control prefix slot forwarded', await ev(() => !!document.querySelector('#fc-text #fc-prefix') && document.querySelector('#fc-text #fc-prefix').offsetParent !== null));
  await p.fill('#fc-text input', 'world').catch(() => {}); await W();
  r('form-control text: update:model-value reaches host', (await st()).txt === 'world', JSON.stringify(await st()));
  r('form-control select: options + model shown', (await txt('#fc-sel [data-slot=trigger]')).includes('B'), await txt('#fc-sel'));
  await p.click('#fc-sel [data-slot=trigger]').catch(() => {}); await W();
  await p.click('[role=option]:has-text("A")', { timeout: 2000 }).catch(e => console.log('  ', e.message.slice(0, 60))); await W();
  r('form-control select: v-model', (await st()).sel === 'a', JSON.stringify(await st()));
  r('form-control checkbox starts unchecked', !(await p.$eval('#fc-chk input', e => e.checked).catch(() => true)));
  await p.click('#fc-chk input').catch(() => {}); await W();
  r('form-control checkbox v-model', (await st()).chk === true, JSON.stringify(await st()));
  await p.fill('#fc-area textarea', 'zz').catch(() => {}); await W();
  r('form-control textarea v-model', (await st()).area === 'zz', JSON.stringify(await st()));
  r('form-control type=number passes through + placeholder attr', await p.$eval('#fc-num input', e => e.type === 'number' && e.placeholder === 'nr').catch(() => false));
  await p.screenshot({ path: __dirname + '/shot-misc.png', fullPage: true });
});
