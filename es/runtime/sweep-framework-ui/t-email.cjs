// jQuery-driven re-run of wc/sweep/framework-ui/t-email.cjs + Desk-style operations.
const ACCTS = [{ name: 'Support', email_account_name: 'Support', email_id: 'support@example.com', service: 'GMail', auth_method: 'Basic', enable_incoming: 1, enable_outgoing: 1, default_incoming: 1, default_outgoing: 1 }]
require('./lib.cjs')('email.html', async ({ p, r: R, txt, st, ev, W, vis, safe, calls, pageErrs, mark }) => {
  const t = 'es-fw-email-accounts', r = (k, v, x) => R(t, k, v, x)
  let s
  await safe(t, 'core', async () => {
    const t0 = await txt('#c-ea')
    r('lists accounts from frappe.client.get_list (mocked)', /Email accounts/.test(t0) && /support@example\.com/.test(t0), t0.slice(0, 200))
    r('get_list called for Email Account', calls.some((c) => c.method === 'frappe.client.get_list' && c.body.doctype === 'Email Account'), calls.map((c) => c.method).join(','))
    await p.click('#c-ea button:has-text("New")'); await W(500)
    const t1 = await txt('#c-ea')
    r('New -> add view with provider tiles (providers prop)', /GMail|Gmail|Google/i.test(t1) && /Custom/i.test(t1), t1.slice(0, 250))
    await p.click('#c-ea button:has-text("Custom"), #c-ea [role=radio]:has-text("Custom"), #c-ea :text("Custom")').catch(() => {}); await W(400)
    const inp = await p.$('#c-ea input[type=email], #c-ea input')
    if (inp) { await inp.fill('me@example.com'); await W(300) }
    s = await st(); r('typing in add form -> update:dirty true', s.dirty === true, JSON.stringify(s.dirty))
    const fillL = async (label, v) => p.locator('#c-ea').getByLabel(label, { exact: false }).first().fill(v).catch((e) => console.log('  fill', label, e.message.slice(0, 80)))
    await fillL('Account name', 'Me'); await fillL('Email address', 'me@example.com'); await fillL('Password', 'pw123456')
    await fillL('Incoming server (IMAP)', 'imap.example.com'); await fillL('Outgoing server (SMTP)', 'smtp.example.com')
    // Desk-style mid-flow move: the add form keeps what was typed
    await ev(() => $('#c-ea').detach().appendTo('#desk')); await W(200)
    r('.detach().appendTo() mid-form keeps typed values', (await p.locator('#c-ea').getByLabel('Account name', { exact: false }).first().inputValue().catch(() => '')) === 'Me')
    await p.click('#c-ea button:has-text("Create")'); await W(800)
    s = await st()
    r('Create -> frappe.client.insert + created event + back to list (dirty false)', calls.some((c) => c.method === 'frappe.client.insert') && s.created.length === 1 && s.dirty === false, JSON.stringify(s))
  })
  r('no page errors in core scenarios', pageErrs().length === 0, pageErrs().join('|'))
  await safe(t, 'desk', async () => {
    const m0 = mark()
    const n = calls.filter((c) => c.method === 'frappe.client.get_list').length
    await ev(() => $('#c-ea').empty()); await W(600)
    r('.empty() on host: remount reloads the list (fresh state)', calls.filter((c) => c.method === 'frappe.client.get_list').length > n && /support@example\.com/.test(await txt('#c-ea')))
    await ev(() => $('<div class="settings-section"><h4>Mail</h4><es-fw-email-accounts id="c-ea2" doctype="HD Ticket"></es-fw-email-accounts></div>').find('es-fw-email-accounts').prop('providers', ['']).end().appendTo('#desk')); await W(600)
    r('second instance from an HTML template lists accounts', /support@example\.com/.test(await txt('#c-ea2')))
    await ev(() => { $('#c-ea2').closest('.settings-section').remove(); $('#c-ea').remove() }); await W(200)
    r('.remove() both; no errors', !(await p.$('#c-ea')) && pageErrs(m0).length === 0, pageErrs(m0).join('|'))
  })
}, {
  wait: 1500,
  api: (m, body) => {
    if (m === 'frappe.client.get_list') return ACCTS
    if (m === 'frappe.client.get_count') return 1
    if (m === 'frappe.client.insert') return Object.assign({ name: 'Me' }, body.doc)
    if (m.endsWith('get_one_click_services')) return []
    return undefined
  },
})
