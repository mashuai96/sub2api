import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import UsageTable from '../UsageTable.vue'
import UsageTimingDialog from '../UsageTimingDialog.vue'
import enDashboard from '@/i18n/locales/en/dashboard'
import zhDashboard from '@/i18n/locales/zh/dashboard'
import enTiming from '@/i18n/locales/en/requestTiming'
import zhTiming from '@/i18n/locales/zh/requestTiming'
import adminPage from '@/views/admin/UsageView.vue?raw'
import userPage from '@/views/user/UsageView.vue?raw'
import { serverLatency } from './fixtures/serverLatency'

vi.mock('@/stores/app', () => ({ useAppStore: () => ({}) }))
vi.mock('@/api/admin/usageTiming', () => ({ getUsageTiming: vi.fn(async () => ({ traces: [], retention_days: 30 })) }))

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = '' })

const locales = {
  en: { usage: enDashboard.usage, requestTiming: enTiming, empty: { noData: 'No data' }, common: { noData: 'No data' } },
  zh: { usage: zhDashboard.usage, requestTiming: zhTiming, empty: { noData: '暂无数据' }, common: { noData: '暂无数据' } },
}
function global(locale: 'en' | 'zh') {
  return { plugins: [createI18n({ legacy: false, locale, messages: locales })] }
}

describe('legacy usage latency without queue or content-timing substitution', () => {
  it('is shared by both admin and user usage pages', () => {
    for (const page of [adminPage, userPage]) {
      expect(page).toContain("import UsageTable from '@/components/admin/usage/UsageTable.vue'")
      expect(page).toContain('<UsageTable')
    }
    expect(adminPage).toContain('enable-timing-details')
    expect(userPage).toContain('enable-timing-details')
  })

  for (const locale of ['en', 'zh'] as const) {
    for (const audience of ['admin', 'user'] as const) {
      it(`keeps 1923/18853ms legacy values instead of 2020/18950ms in ${locale} ${audience} table or tooltip`, () => {
        const wrapper = mount(UsageTable, {
          props: {
            data: [serverLatency], columns: [
              { key: 'latency', label: 'Latency' },
              { key: 'performance', label: 'Performance' },
            ],
            enableTimingDetails: audience === 'admin', cacheRateAudience: audience,
            showAccountBilling: audience === 'admin',
          }, global: global(locale),
        })
        wrappers.push(wrapper)
        const latency = wrapper.get('[data-testid="latency-bar"]').element.parentElement!
        expect(latency.textContent).toContain('1.92s')
        expect(latency.textContent).toContain('18.85s')
        expect(latency.textContent).not.toMatch(/97ms|pre-forward|转发前|queuePortion/)
        const titles = Array.from(latency.querySelectorAll('[title]')).map(node => node.getAttribute('title')).join(' ')
        expect(titles).not.toMatch(/97ms|0\.097|2\.02s|18\.95s|\{queue\}/)
        expect(titles).toContain(locale === 'zh' ? '服务端' : 'Server')
        expect(latency.querySelector('.row-start-1.col-start-3')?.textContent?.trim()).toBe('1.92s')
        expect(latency.querySelector('.row-start-2.col-start-3')?.textContent?.trim()).toBe('18.85s')
        expect(wrapper.get('th').text()).toBe('Latency')
        expect(wrapper.get('[data-testid="latency-tps"]').text()).toBe('10.6 t/s')
      })
    }

    it(`keeps empty/unknown and historical values in ${locale}`, () => {
      const wrapper = mount(UsageTable, {
        props: { columns: [{ key: 'latency', label: 'Latency' }], data: [{
          ...serverLatency, queue_timing: { ...serverLatency.queue_timing!, status: 'unknown' },
          first_token_ms: null, duration_ms: null, output_tokens: 0,
        }] }, global: global(locale),
      })
      wrappers.push(wrapper)
      const latency = wrapper.get('[data-testid="latency-bar"]').element.parentElement!
      expect(latency.querySelector('.row-start-1.col-start-3')?.textContent).toBe('-')
      expect(latency.querySelector('.row-start-2.col-start-3')?.textContent?.trim()).toBe('-')
      expect(latency.textContent).not.toContain('97ms')
      expect(latency.textContent).toContain(locales[locale].usage.latencyFirstTokenShort)
      expect(latency.textContent).toContain(locales[locale].usage.latencyDurationShort)
      const empty = mount(UsageTable, { props: { data: [], columns: [{ key: 'latency', label: 'Latency' }] }, global: global(locale) })
      wrappers.push(empty)
      expect(empty.text()).toContain(locales[locale].empty.noData)
    })

    it(`restores the v2.19.4 wait summary and measured/legacy distinction in the ${locale} timing dialog`, async () => {
      const wrapper = mount(UsageTimingDialog, {
        props: { record: serverLatency }, attachTo: document.body, global: global(locale),
      })
      wrappers.push(wrapper)
      await flushPromises()
      const body = document.body.querySelector('.modal-body')!
      const labels = Array.from(body.querySelectorAll('.rounded-xl.border.p-4 > .text-sm')).map(node => node.textContent)
      expect(labels).toContain(locales[locale].requestTiming.serverFirst)
      expect(labels).toContain(locales[locale].requestTiming.serverTotal)
      expect(labels).toContain(locales[locale].requestTiming.queueWait)
      expect(body.textContent).toContain('1.92s')
      expect(body.textContent).toContain('18.85s')
      expect(body.textContent).toContain('97ms')
      expect(body.textContent).toContain('2.02s')
      expect(body.textContent).toContain('18.95s')
      expect(body.querySelector('[data-testid="final-content-timing"]')).toBeNull()
      expect(body.textContent).toContain(locales[locale].requestTiming.empty)
      expect(body.textContent).toContain(locales[locale].requestTiming.missing)
    })
  }
})

for (const audience of ['admin', 'user'] as const) {
  it(`shows the screenshot's 876ms / 8.18s in the ${audience} table, not 2.94s / 10.24s`, () => {
    const record = { ...serverLatency, first_token_ms: 876, duration_ms: 8180,
      queue_timing: { ...serverLatency.queue_timing!, server_first_token_ms: 2940, server_duration_ms: 10240 },
      content_timing: { ...serverLatency.content_timing!, sse_event_first_ms: 2940, semantic_first_ms: 10060 },
    }
    const wrapper = mount(UsageTable, { props: {
      data: [record], columns: [{ key: 'latency', label: 'Latency' }],
      enableTimingDetails: true, cacheRateAudience: audience,
    }, global: global('zh') })
    wrappers.push(wrapper)
    const latency = wrapper.get('[data-testid="usage-latency"]')
    expect(latency.text()).toContain('876ms')
    expect(latency.text()).toContain('8.18s')
    expect(latency.text()).not.toMatch(/2\.94s|10\.24s|10\.06s/)
    expect(latency.get('.row-start-1.col-start-3').classes()).toContain('text-emerald-600')
    expect(latency.get('.row-start-2.col-start-3').classes()).toContain('text-emerald-600')
  })
}

it('does not replace a missing legacy timer with measured queue or content timing', () => {
  const wrapper = mount(UsageTable, { props: {
    data: [{ ...serverLatency, first_token_ms: null, duration_ms: null }],
    columns: [{ key: 'latency', label: 'Latency' }],
  }, global: global('en') })
  wrappers.push(wrapper)
  const latency = wrapper.get('[data-testid="usage-latency"]')
  expect(latency.get('.row-start-1.col-start-3').text()).toBe('-')
  expect(latency.get('.row-start-2.col-start-3').text()).toBe('-')
})
