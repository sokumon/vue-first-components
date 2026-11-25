<script setup>
import { defineComponent, h, reactive, ref, shallowReactive, markRaw } from 'vue'
import { ConfigProvider } from 'reka-ui'
import Combobox from 'fui-src/components/Combobox/Combobox.vue'
import { providePortalTarget } from 'fui-src/composables/usePortalTarget'

const strip = (v) => JSON.parse(JSON.stringify(v ?? null, (k, x) => (typeof x === 'function' ? '[fn]' : x && typeof x === 'object' && (x.render || x.setup) ? '[component]' : x)))
const L = (sc) => ({
  'onUpdate:modelValue': (v) => window.__log.push([sc, 'update:modelValue', strip(v)]),
  'onUpdate:open': (v) => window.__log.push([sc, 'update:open', v]),
  'onUpdate:query': (v) => window.__log.push([sc, 'update:query', v]),
  'onUpdate:selectedOption': (v) => window.__log.push([sc, 'update:selectedOption', strip(v)]),
  onFocus: (e) => window.__log.push([sc, 'focus', e && e.type]),
  onBlur: (e) => window.__log.push([sc, 'blur', e && e.type]),
})

const customRow = {
  type: 'custom', key: 'create', label: 'Create new', icon: 'lucide-plus',
  onClick: (ctx) => window.__log.push(['s1', 'custom-click', strip(ctx)]),
}
const baseOptions = [
  { label: 'Acme Corp', value: 'acme', description: 'Retail' },
  { label: 'Globex', value: 'globex' },
  { label: 'Initech', value: 'initech', disabled: true },
  { group: 'More', options: [
    { label: 'Umbrella', value: 'umbrella', icon: 'lucide-umbrella' },
    { label: 'Hooli', value: 'hooli' },
  ] },
  customRow,
]
const iconOptions = [
  { label: 'Open', value: 'open', icon: 'lucide-circle' },
  { label: 'Closed', value: 'closed', icon: 'lucide-check' },
  { label: 'Archived', value: 'archived' },
]

const S = reactive({
  s1: { value: null, opts: baseOptions },
  s3: { value: null, flag: false },
  s4: { value: 'closed', query: undefined },
  s5: { value: null },
  s6: { value: 'acme' },
  s9: { open: true, value: 'globex' },
  s12: { loading: true },
  s13: { value: null, open: false },
})
const refs = { s1: ref(null), s4: ref(null), s5: ref(null) }

// Desk-like control built with h() (as the es-* glue does): controlled open and query, filterable false.
const desk = shallowReactive({ options: [], modelValue: null, query: '', open: false, emptyText: 'Nothing here', placeholder: 'Customer' })
const DeskCell = defineComponent({
  name: 'DeskCell',
  setup() {
    const slots = { 'item-html': ({ item }) => h('span', { class: 'es-link-html', 'data-html': item.value }, `<b>${item.label}</b>`) }
    return () => h(Combobox, {
      class: 'w-full es-link-input', 'data-test': 'desk',
      options: desk.options, modelValue: desk.modelValue, query: desk.query, open: desk.open,
      filterable: false, openOnFocus: false, openOnClick: false,
      placeholder: desk.placeholder, emptyText: desk.emptyText, portalTo: '#portal-a',
      ...L('s2'),
      'onUpdate:open': (v) => { window.__log.push(['s2', 'update:open', v]); desk.open = v },
      'onUpdate:query': (v) => { window.__log.push(['s2', 'update:query', v]); desk.query = v },
      'onUpdate:modelValue': (v) => { window.__log.push(['s2', 'update:modelValue', v]); desk.modelValue = v },
    }, slots)
  },
})

const HostTarget = defineComponent({
  name: 'HostTarget',
  setup(_, { slots }) { providePortalTarget('#host-target'); return () => slots.default?.() },
})

window.T = {
  S, desk,
  call: (sc, m) => refs[sc].value[m](),
  setDesk: (patch) => Object.assign(desk, patch),
  deskOptions: (n) => markRaw(Array.from({ length: n }, (_, i) => ({ label: `Customer ${i}`, value: `CUST-${i}`, description: i % 2 ? 'Retail' : undefined, slot: i % 2 ? 'html' : undefined }))),
}
</script>

<template>
  <div class="space-y-4">
    <section id="s1">
      <Combobox :ref="refs.s1" v-model="S.s1.value" v-bind="L('s1')" :options="S.s1.opts" label="Customer" description="Pick one" placeholder="Pick customer" />
    </section>

    <section id="s2"><DeskCell /></section>

    <section id="s3">
      <Combobox v-model="S.s3.value" v-bind="L('s3')" :options="baseOptions" label="Slotted" error="Bad value" required empty-text="none">
        <template v-if="S.s3.flag" #prefix="{ open }"><span data-test="prefix">P{{ open ? 'o' : 'c' }}</span></template>
        <template #suffix="{ clear, displayValue }"><button type="button" data-test="clear" @click="clear">x {{ displayValue }}</button></template>
        <template #item-prefix="{ item, selected }"><span data-test="item-prefix">{{ selected ? '*' : '-' }}{{ item.value }}</span></template>
        <template #item-suffix="{ item }"><kbd>{{ String(item.value ?? item.key).length }}</kbd></template>
        <template #group-label="{ group }"><em data-test="group">{{ group.group }}!</em></template>
        <template #empty="{ query }"><p data-test="empty">No match for {{ query }}</p></template>
        <template #footer="{ selectedOption, close }"><div data-test="footer">sel={{ selectedOption?.value ?? 'none' }}<button type="button" @click="close">close</button></div></template>
      </Combobox>
    </section>

    <section id="s4">
      <Combobox :ref="refs.s4" v-model="S.s4.value" v-bind="L('s4')" :options="iconOptions" trigger="button" label="Status" placeholder="Pick status">
        <template #search-prefix="{ query }"><span data-test="sp">[{{ query }}]</span></template>
        <template #search-suffix="{ setQuery }"><button type="button" data-test="ss" @click="setQuery('arch')">arch</button></template>
      </Combobox>
    </section>

    <section id="s5">
      <Combobox :ref="refs.s5" v-model="S.s5.value" v-bind="L('s5')" :options="iconOptions" hide-search>
        <template #trigger="{ displayValue, open }"><button type="button" data-test="mytrigger">T:{{ displayValue || 'none' }}:{{ open }}</button></template>
      </Combobox>
    </section>

    <section id="s6">
      <Combobox v-model="S.s6.value" v-bind="L('s6')" :options="baseOptions" disabled />
      <Combobox v-model="S.s6.value" v-bind="L('s6b')" :options="baseOptions" trigger="button" disabled />
    </section>

    <section id="s8">
      <Combobox v-bind="L('s8')" :options="baseOptions" readonly id="my-input" name="cust" class="extra-class" style="max-width: 300px" autocomplete="on" size="lg" variant="outline" />
    </section>

    <section id="s9">
      <Combobox v-model="S.s9.value" v-model:open="S.s9.open" v-bind="L('s9')" :options="baseOptions" />
    </section>

    <section id="s10">
      <ConfigProvider teleport-to="#cp-target">
        <Combobox v-bind="L('s10')" :options="iconOptions" placeholder="cp" />
      </ConfigProvider>
      <HostTarget>
        <Combobox v-bind="L('s11')" :options="iconOptions" placeholder="host" />
      </HostTarget>
    </section>

    <section id="s12">
      <Combobox v-bind="L('s12')" :options="iconOptions" :loading="S.s12.loading" trigger="button" />
    </section>

    <section id="s13">
      <Combobox v-model="S.s13.value" v-model:open="S.s13.open" v-bind="L('s13')" :options="iconOptions" :open-on-click="false" side="top" align="end" :offset="10" />
    </section>
  </div>
</template>
