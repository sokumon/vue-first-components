const run = require('./lib.cjs');
run('fields.html', async ({ p, r, txt, st, calls, errs }) => {
  const S = st;
  const ch = () => txt('#changes');
  let s = await S();
  // Data: initial value in input, typing updates doc, blur fires change
  r('Data initial value', (await p.inputValue('#f-data input')) === 'Ada');
  await p.fill('#f-data input', 'Grace'); s = await S();
  r('Data v-model typing', s.data === 'Grace', s.data);
  await p.locator('#f-data input').blur(); await p.waitForTimeout(100);
  r('Data change on commit', (await ch()).includes('data="Grace"'), await ch());
  // Textarea, Password, Phone
  await p.fill('#f-notes textarea', 'two\nlines'); r('Textarea v-model', (await S()).notes === 'two\nlines');
  await p.fill('#f-pw input', 's3cret'); r('Password v-model', (await S()).pw === 's3cret');
  r('Password masked', (await p.getAttribute('#f-pw input', 'type')) === 'password');
  await p.fill('#f-phone input', '+1 555'); r('Phone v-model', (await S()).phone === '+1 555');
  // Number
  r('Float formatted', (await p.inputValue('#f-hours input')) === '1.50', await p.inputValue('#f-hours input'));
  await p.click('#f-hours input'); await p.fill('#f-hours input', '12.345'); await p.keyboard.press('Tab'); await p.waitForTimeout(100);
  s = await S(); r('Float parses to number', s.hours === 12.345 || s.hours === 12.35, JSON.stringify(s.hours) + ' changes=' + (await ch()));
  r('Int initial', (await p.inputValue('#f-qty input')) === '3', await p.inputValue('#f-qty input'));
  await p.fill('#f-qty input', '7'); await p.keyboard.press('Tab'); r('Int v-model number', (await S()).qty === 7, JSON.stringify((await S()).qty));
  r('Currency shows value', /10/.test(await p.inputValue('#f-amt input')), await p.inputValue('#f-amt input'));
  // Check 0|1
  const cbSel = '#f-done input[type=checkbox], #f-done button[role=checkbox]';
  r('Check starts unchecked', !(await p.isChecked(cbSel).catch(() => true)));
  await p.click(cbSel); await p.waitForTimeout(100);
  r('Check -> 1 + change', (await S()).done === 1 && (await ch()).includes('done=1'), (await S()).done + ' ' + (await ch()));
  // Select
  await p.click('#f-status button'); await p.waitForTimeout(300);
  await p.click('[role=option]:has-text("Closed")'); await p.waitForTimeout(200);
  r('Select picks option', (await S()).status === 'Closed', (await S()).status);
  r('Select trigger shows value', (await txt('#f-status')).includes('Closed'));
  // Autocomplete (combobox, static options)
  await p.click('#f-fruit input'); await p.waitForTimeout(300);
  const opts = await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim()));
  r('Autocomplete lists options on click', opts.join(',').includes('Banana'), opts.join(','));
  await p.click('[role=option]:has-text("Banana")').catch(() => {}); await p.waitForTimeout(200);
  r('Autocomplete pick', (await S()).fruit === 'Banana', (await S()).fruit);
  await p.keyboard.press('Escape');
  // Link (backend search_link mocked)
  await p.click('#f-user input'); await p.waitForTimeout(300);
  await p.keyboard.type('grace'); await p.waitForTimeout(800);
  const lo = await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim().replace(/\s+/g, ' ')));
  r('Link fetches search_link with txt', calls.some((c) => c.method === 'frappe.desk.search.search_link' && c.body.txt === 'grace' && c.body.doctype === 'User'), JSON.stringify(calls.filter((c) => c.method.includes('search')).map((c) => c.body)));
  r('Link shows options', lo.some((x) => x.includes('Grace Hopper')), lo.join('|'));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  s = await S(); r('Link keyboard select -> v-model + change', s.user === 'grace@example.com' && (await ch()).includes('user="grace@example.com"'), s.user + ' ' + (await ch()));
  await p.keyboard.press('Escape');
  // Dynamic Link: with row prop it resolves doctype; without, disabled
  r('DynamicLink with :row enabled', !(await p.isDisabled('#f-dyn input')));
  r('DynamicLink without row/DocKey disabled', await p.isDisabled('#f-dyn-norow input'));
  // Date / Datetime / Time / Duration display
  r('Date displays value', /2026|Nov|20/.test(await p.inputValue('#f-due input').catch(() => '')), await p.inputValue('#f-due input').catch(() => 'ERR'));
  await p.click('#f-due input'); await p.waitForTimeout(400);
  const day = p.locator('[role=dialog] :text-is("25"), [data-reka-popper-content-wrapper] :text-is("25")').first();
  if (await day.count()) { await day.click(); await p.waitForTimeout(200) }
  r('Date picker picks a day', (await S()).due === '2026-11-25', (await S()).due);
  await p.keyboard.press('Escape');
  r('Datetime displays value', /10:30|2026/.test(await p.inputValue('#f-at input').catch(() => '')), await p.inputValue('#f-at input').catch(() => 'ERR'));
  r('Time displays value', /9:15|09:15/.test(await p.inputValue('#f-tm input').catch(() => '')), await p.inputValue('#f-tm input').catch(() => 'ERR'));
  const durT = (await txt('#f-dur')) + ' / ' + (await p.$$eval('#f-dur input', (e) => e.map((x) => x.value).join(',')));
  r('Duration displays value', /1h|1 h|01:00|3600|\b1\b/.test(durT), durT);
  // Rating 0.4 => 2 of 5 stars; click 4th star
  const stars = await p.$$('#f-stars button[data-slot=star]');
  const states = () => p.$$eval('#f-stars button[data-slot=star]', (e) => e.map((x) => x.dataset.state).join(','));
  r('Rating 5 stars, 0.4 -> 2 filled', stars.length === 5 && (await p.getAttribute('#f-stars button[data-index="2"]', 'data-state')) === 'filled' && (await p.getAttribute('#f-stars button[data-index="3"]', 'data-state')) === 'empty', stars.length + ' ' + (await states()));
  if (stars.length >= 4) { const bb = await stars[3].boundingBox(); await p.mouse.move(bb.x + bb.width * 0.85, bb.y + bb.height / 2); await p.mouse.click(bb.x + bb.width * 0.85, bb.y + bb.height / 2); await p.waitForTimeout(200) }
  r('Rating click 4th star -> 0.8', Math.abs((await S()).stars - 0.8) < 0.01, (await S()).stars + ' ' + (await states()));
  // Color
  r('Color hex shown', (await p.inputValue('#f-color input')).toLowerCase().includes('ff0000'), await p.inputValue('#f-color input'));
  const sw = await p.$('#f-color button[data-slot=swatch]');
  r('Color swatch teleported into the field row', !!sw);
  if (sw) {
    await sw.click(); await p.waitForTimeout(400);
    const pick = await p.$$('[data-reka-popper-content-wrapper] button');
    if (pick[1]) { await pick[1].click(); await p.waitForTimeout(200) }
  }
  r('Color pick -> change', (await ch()).includes('color='), await ch());
  await p.keyboard.press('Escape');
  // Heading / HTML / Button / Image
  r('Heading', (await txt('#f-heading h4')) === 'Section heading');
  r('HTML sanitized', (await txt('#html-p')) === 'Hello bold' && !(await p.evaluate(() => window.__xss)), await p.$eval('#f-html', (e) => e.innerHTML));
  await p.click('#f-btn button'); await p.waitForTimeout(100);
  r('Button field native click bubbles to host', (await ch()).includes('btn=1'), await ch());
  r('Image field uses modelValue', (await p.getAttribute('#f-img img', 'src').catch(() => null)) === 'http://fw.test/build/none.png');
  // Code editor
  const cm = await p.$('#f-json .cm-content');
  r('CodeEditor renders codemirror', !!cm);
  if (cm) { await cm.click(); await p.keyboard.press('Control+End'); await p.keyboard.type(' '); await p.waitForTimeout(500) }
  r('CodeEditor typing -> v-model', (await S()).json !== '{"a": 1}', JSON.stringify((await S()).json));
  // Geolocation (leaflet)
  r('Geolocation summary of initial point', /12\.9|77\.5/.test(await p.inputValue('#f-loc input')), await p.inputValue('#f-loc input'));
  await p.click('#f-loc input'); await p.waitForTimeout(1500);
  r('Geolocation dialog with leaflet map + marker', !!(await p.$('[role=dialog] .leaflet-container')) && !!(await p.$('[role=dialog] .leaflet-marker-icon')), (await txt('[role=dialog]')).slice(0, 120));
  await p.click('[role=dialog] button:has-text("Save")').catch(() => {}); await p.waitForTimeout(300);
  s = await S(); r('Geolocation Save -> geojson v-model', typeof s.loc === 'string' && s.loc.includes('FeatureCollection') && !(await p.$('[role=dialog]')), String(s.loc).slice(0, 100));
  // Table MultiSelect
  await p.click('#f-tags input, #f-tags button').catch(() => {}); await p.waitForTimeout(800);
  const tm = await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim().replace(/\s+/g, ' ')));
  r('TableMultiSelect options from search_link', tm.some((x) => x.includes('Ada')), tm.join('|'));
  await p.click('[role=option]:has-text("Ada")').catch(() => {}); await p.waitForTimeout(300); await p.keyboard.press('Escape');
  s = await S(); r('TableMultiSelect -> child rows', Array.isArray(s.tags) && s.tags[0] && s.tags[0].tag === 'ada@example.com', JSON.stringify(s.tags));
  // Table (child grid)
  await p.click('#f-rows button:has-text("Add Row")'); await p.waitForTimeout(400);
  s = await S(); r('Table add row', Array.isArray(s.rows) && s.rows.length === 1, JSON.stringify(s.rows));
  const tr = await p.$$eval('#f-rows .grid-row', (e) => e.map((x) => x.querySelectorAll('.grid-cell[data-fieldname=item] input, .grid-cell[data-fieldname=item] textarea').length));
  r('Table row drawn with an editor (standalone, no FormLayout provider)', tr.length === 1 && tr[0] >= 1, JSON.stringify(tr));
  // Attach: opens upload dialog; upload via mocked /api/method/upload_file
  await p.click('#f-att input'); await p.waitForTimeout(1000);
  const dlg = await p.$('[role=dialog]');
  r('Attach opens upload dialog', !!dlg, dlg ? (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 150) : '');
  const fi = await p.$('input[type=file]');
  if (fi) {
    await fi.setInputFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }); await p.waitForTimeout(400);
    await p.getByRole('dialog').getByRole('button', { name: 'Upload', exact: true }).click().catch((e) => console.log('  no upload btn', e.message.slice(0, 80))); await p.waitForTimeout(1500);
  }
  s = await S(); r('Attach upload -> file_url v-model', s.att === '/files/hello.txt', JSON.stringify(s.att) + ' calls=' + calls.map((c) => c.method).join(','));
  const pe = errs.filter((e) => e.startsWith('pageerror'));
  r('host @change handlers see only component change events (no native change bubbling in)', pe.length === 0, pe.join(' | '));
}, {
  wait: 1200, shot: 'shot-fields.png',
  api: (m) => (m === 'upload_file' ? { name: 'F1', file_name: 'hello.txt', file_url: '/files/hello.txt', is_private: 0 } : undefined),
});
