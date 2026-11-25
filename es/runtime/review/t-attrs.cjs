// Fall-through attributes stay on the host AND land on the component root: Desk selectors and delegation.
const { run } = require('./lib.cjs')
run('attrs', 'desk.html', async ({ p, r, ev }) => {
  const a = await ev(() => {
    $('#body').html('<div class="frappe-control" data-fieldname="status"><es-button data-fieldname="save" class="btn-save" label="Save"></es-button></div>'); ES.flush()
    let n = 0, m = 0
    $(document).on('click', '[data-fieldname=save]', () => n++).on('click', '.btn-save', () => m++)
    $('#body button')[0].click()
    return { byData: $('[data-fieldname=save]').length, byClass: $('.btn-save').length, dataFires: n, classFires: m, closest: $('#body button').closest('[data-fieldname]').prop('localName') }
  })
  r('data-* / class on a host match once (Desk: $(`[data-fieldname=...]`), delegated handlers)', a.byData === 1 && a.dataFires === 1 && a.classFires === 1, a)
})
