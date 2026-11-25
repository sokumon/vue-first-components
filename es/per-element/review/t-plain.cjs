// A non-petite host: properties, attributes, addEventListener, and DOM writes jQuery code does.
require('./lib.cjs').run('p-plain.html', async ({ p, r, info, wait, txt }) => {
  // 1. create + set object prop before connect + listen
  const s1 = await p.evaluate(async () => {
    const el = document.createElement('es-select');
    el.options = [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }];
    el.modelValue = 'red';
    const got = [];
    el.addEventListener('update:modelValue', (e) => got.push('camel:' + e.detail[0]));
    el.addEventListener('update:model-value', (e) => got.push('kebab:' + e.detail[0]));
    document.getElementById('root').append(el);
    await new Promise(r => setTimeout(r, 300));
    window.__sel = el; window.__got = got;
    return { optType: typeof el._props.options, text: el.innerText.trim() };
  });
  r('plain DOM: object prop set before connect is kept as object', s1.optType === 'object', s1);
  await p.click('#root es-select button'); await wait(300);
  await p.click('[role=option]:has-text("Blue")'); await wait(150);
  const got = await p.evaluate(() => window.__got);
  r('plain DOM: addEventListener receives update:modelValue (both spellings)', got.includes('camel:blue') && got.includes('kebab:blue'), got);
  // 2. setAttribute on a boolean / number prop
  const s2 = await p.evaluate(async () => {
    const b = document.createElement('es-button'); b.setAttribute('label', 'L'); b.setAttribute('loading', 'false');
    document.getElementById('root').append(b); await new Promise(r => setTimeout(r, 100));
    return { loading: b._props.loading, disabled: b.querySelector('button')?.disabled };
  });
  r('plain DOM: setAttribute("loading","false") means not loading', s2.disabled === false, s2);
  // 3. el.id / label[for] / duplicate ids (sweep claim es-checkbox broken)
  const ids = await p.evaluate(() => ({
    hostId: document.getElementById('c1').id,
    inputIds: [...document.querySelectorAll('es-checkbox input')].map(i => i.id),
    dupTotal: (() => { const m = {}; document.querySelectorAll('[id]').forEach(e => m[e.id] = (m[e.id] || 0) + 1); return Object.entries(m).filter(([, n]) => n > 1) })(),
  }));
  info('ids', ids);
  r('[claim es-checkbox broken] duplicate inner ids across elements', ids.inputIds[0] && ids.inputIds[0] === ids.inputIds[1], ids.inputIds);
  r('[claim] host el.id hidden by prop accessor', ids.hostId !== 'c1', ids.hostId);
  await p.click('#c2 label'); await wait(100);
  const chk = await p.evaluate(() => [...document.querySelectorAll('es-checkbox input')].map(i => i.checked));
  r('[claim] clicking label of 2nd checkbox toggles the 1st', chk[0] === true && chk[1] === false, chk);
  // 4. jQuery-style writes into the host after mount
  const s4 = await p.evaluate(async () => {
    const el = document.getElementById('static');
    const extra = document.createElement('i'); extra.textContent = 'appended'; el.append(extra);
    el.label = 'Changed'; await new Promise(r => setTimeout(r, 50));
    const a = { html: el.innerHTML.replace(/\s+/g, ' ').slice(0, 300), text: el.innerText };
    el.textContent = 'jq text'; await new Promise(r => setTimeout(r, 50));
    let err = null; try { el.label = 'Again'; await new Promise(r => setTimeout(r, 50)) } catch (e) { err = e.message }
    return { a, after: el.innerHTML.slice(0, 200), err };
  });
  info('append + label change', s4.a);
  r('appended child after mount becomes slot content (it does not)', s4.a.text.includes('Changed') && !/appended[\s\S]*Changed|Changed[\s\S]*appended/.test(s4.a.text) === false, s4.a.text);
  info('after el.textContent= then el.label=Again', s4);
  // 5. late slot change: innerHTML replaced on a fresh element before connect works?
  const s5 = await p.evaluate(async () => {
    const el = document.createElement('es-button'); el.innerHTML = '<b>Bold</b> slot'; document.body.append(el);
    await new Promise(r => setTimeout(r, 50)); const t1 = el.querySelector('button')?.innerText;
    el.querySelector('b').textContent = 'Edited'; await new Promise(r => setTimeout(r, 50));
    return { t1, t2: el.querySelector('button')?.innerText };
  });
  r('slot nodes stay live for plain DOM edits', s5.t2 === 'Edited slot', s5);
  // 6. property readback & methods
  const s6 = await p.evaluate(() => { const e = document.querySelector('#root es-select'); return { mv: e.modelValue, kebab: e['model-value'], attr: e.getAttribute('model-value'), focus: typeof e.focus } });
  info('readback', s6);
});
