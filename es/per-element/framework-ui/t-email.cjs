const run = require('./lib.cjs');
const ACCTS = [{ name: 'Support', email_account_name: 'Support', email_id: 'support@example.com', service: 'GMail', auth_method: 'Basic', enable_incoming: 1, enable_outgoing: 1, default_incoming: 1, default_outgoing: 1 }];
run('email.html', async ({ p, r, txt, st, stPoked, calls }) => {
  let s;
  const t0 = (await txt('#c-ea')).replace(/\s+/g, ' ');
  r('lists accounts from frappe.client.get_list (mocked)', /Email accounts/.test(t0) && /support@example\.com/.test(t0), t0.slice(0, 200));
  r('get_list called for Email Account', calls.some((c) => c.method === 'frappe.client.get_list' && c.body.doctype === 'Email Account'), calls.map((c) => c.method).join(','));
  await p.click('#c-ea button:has-text("New")'); await p.waitForTimeout(500);
  const t1 = (await txt('#c-ea')).replace(/\s+/g, ' ');
  r('New -> add view with provider tiles (providers prop)', /GMail|Gmail|Google/i.test(t1) && /Custom/i.test(t1), t1.slice(0, 250));
  // choose custom provider and type -> dirty v-model
  await p.click('#c-ea button:has-text("Custom"), #c-ea [role=radio]:has-text("Custom"), #c-ea :text("Custom")').catch((e) => console.log('  custom', e.message.slice(0, 60))); await p.waitForTimeout(400);
  const inp = await p.$('#c-ea input[type=email], #c-ea input');
  if (inp) { await inp.fill('me@example.com'); await p.waitForTimeout(300) }
  s = await stPoked(); r('typing in add form -> v-model:dirty true', s.dirty === true, JSON.stringify(s.dirty) + ' :: ' + (await txt('#c-ea')).replace(/\s+/g, ' ').slice(0, 200));
  const fillL = async (label, v) => p.locator('#c-ea').getByLabel(label, { exact: false }).first().fill(v).catch((e) => console.log('  fill', label, e.message.slice(0, 80)));
  await fillL('Account name', 'Me'); await fillL('Email address', 'me@example.com'); await fillL('Password', 'pw123456');
  await fillL('Incoming server (IMAP)', 'imap.example.com'); await fillL('Outgoing server (SMTP)', 'smtp.example.com');
  await p.click('#c-ea button:has-text("Create")'); await p.waitForTimeout(800);
  s = await stPoked();
  r('Create -> frappe.client.insert + created event + back to list (dirty false)', calls.some((c) => c.method === 'frappe.client.insert') && s.created.length === 1 && s.dirty === false, JSON.stringify(s) + ' ' + calls.map((c) => c.method).slice(-3).join(','));
}, {
  wait: 1500, shot: 'shot-email.png',
  api: (m, body) => {
    if (m === 'frappe.client.get_list') return ACCTS;
    if (m === 'frappe.client.get_count') return 1;
    if (m === 'frappe.client.insert') return Object.assign({ name: 'Me' }, body.doc);
    if (m.endsWith('get_one_click_services')) return [];
    return undefined;
  },
});
