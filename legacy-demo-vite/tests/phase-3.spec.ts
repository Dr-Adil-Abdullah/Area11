import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { type AppState } from '../src/domain/model'
import { PHASE2_BACKUP_KEY } from '../src/data/migrations'
import { recordSalesReturn } from '../src/domain/returns'
import { editSupplier } from '../src/domain/suppliers'
import { soldFixture, returnAt, toV2 } from './fixtures'

const key = 'area11.phase1.workspace.v1'
const saved = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)!) as AppState, key)
const nav = (page: Page, name: string) =>
  page
    .getByRole('navigation', {
      name: (page.viewportSize()?.width ?? 1440) <= 800 ? 'Mobile navigation' : 'Main navigation',
      exact: true,
    })
    .getByRole('button', { name, exact: true })
    .click()
async function load(page: Page, state: AppState) {
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key,
    raw: JSON.stringify(state),
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
}
async function newSupplier(page: Page, direction = 'payable', amount = '0') {
  await page.getByRole('button', { name: 'New supplier', exact: true }).click()
  const d = page.getByRole('dialog')
  await expect(d.getByLabel('Supplier starting balance', { exact: true })).toHaveValue('')
  await d.getByLabel('Supplier profile name').fill('Phase 3 E2E supplier')
  await d.getByLabel('Supplier agency').fill('Sample agency')
  await d.getByLabel('Supplier phone').fill('03001234567')
  await d.getByLabel('Supplier starting balance direction').selectOption(direction)
  await d.getByLabel('Supplier starting balance', { exact: true }).fill(amount)
  await d.getByRole('checkbox').check()
  await d.getByRole('button', { name: 'Create supplier', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  return (await saved(page)).suppliers.at(-1)!.id
}
async function selectSupplier(page: Page, name = 'Phase 3 E2E supplier') {
  await nav(page, 'Suppliers')
  await page.getByLabel('Search suppliers').fill(name)
  await page.locator('.supplier-list-item').filter({ hasText: name }).click()
}
async function receive(
  page: Page,
  supplierId: string,
  batch = 'PH3-PAID',
  qty = '5',
  bonus = false,
) {
  await nav(page, 'Stock in')
  const p = (await saved(page)).products.find((p) => p.name === 'Panadol 500 mg')!
  await page.getByLabel('Supplier profile', { exact: true }).selectOption(supplierId)
  await page.getByLabel('Product for stock item 1').selectOption(p.id)
  await page.getByLabel('Purchase unit for stock item 1').selectOption('loose')
  await page.getByLabel('Quantity for stock item 1').fill(qty)
  await page.getByLabel('Batch number for stock item 1').fill(batch)
  await page.getByLabel('Expiry date for stock item 1').fill('2030-12-31')
  await page.getByLabel('Stock type for item 1').selectOption(bonus ? 'bonus' : 'standard')
  if (!bonus) await page.getByLabel('Cost per base unit for stock item 1').fill('5')
  await page.getByLabel('Retail per base unit for stock item 1').fill('7')
  await page.getByRole('button', { name: 'Receive & save stock', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
}
async function openShift(page: Page) {
  await nav(page, 'Cash drawer')
  await page.getByLabel('Cash operator label').fill('Phase 3 sample operator')
  await page.getByLabel('Opening float', { exact: true }).fill('1000')
  await page.getByRole('button', { name: 'Open cash shift', exact: true }).click()
}
async function supplierCash(page: Page, amount: string, kind = 'payment') {
  await page.getByRole('button', { name: 'Record cash settlement', exact: true }).click()
  const d = page.getByRole('dialog')
  await expect(d.getByLabel('Supplier cash amount')).toHaveValue('')
  await d.getByLabel('Supplier cash movement').selectOption(kind)
  await d.getByLabel('Supplier cash amount').fill(amount)
  await d.getByLabel('Supplier cash reference').fill(`PH3-${kind}`)
  await d.getByRole('checkbox').check()
  await d.getByRole('button', { name: 'Save supplier cash', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
async function supplierReturn(page: Page, batch: string, shelf: string, reference = 'PH3-CREDIT') {
  await page.getByRole('button', { name: 'Return goods to supplier', exact: true }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel(`Supplier shelf units for ${batch}`, { exact: true }).fill(shelf)
  await d.getByLabel('Supplier credit note reference').fill(reference)
  await d.getByRole('checkbox').check()
  return d
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
})

test('creates an inline supplier without losing draft quantities, and receives zero-cost bonus boxes', async ({
  page,
}) => {
  await nav(page, 'Stock in')
  const p = (await saved(page)).products[0]
  await page.getByLabel('Product for stock item 1').selectOption(p.id)
  await page.getByLabel('Quantity for stock item 1').fill('2')
  await page.getByLabel('Batch number for stock item 1').fill('PH3-BONUS')
  await page.getByLabel('Expiry date for stock item 1').fill('2030-12-31')
  await page.getByLabel('Stock type for item 1').selectOption('bonus')
  const supplierId = await newSupplier(page)
  await expect(page.getByLabel('Supplier profile', { exact: true })).toHaveValue(supplierId)
  await expect(page.getByLabel('Quantity for stock item 1')).toHaveValue('2')
  await expect(page.getByLabel('Batch number for stock item 1')).toHaveValue('PH3-BONUS')
  await expect(page.getByLabel('Cost per base unit for stock item 1')).toHaveValue('0.00')
  await expect(page.getByLabel('Cost per base unit for stock item 1')).toHaveAttribute(
    'readonly',
    '',
  )
  const before = await saved(page)
  await page.getByRole('button', { name: 'Receive & save stock', exact: true }).click()
  const purchase = (await saved(page)).purchases.at(-1)!
  expect(purchase).toMatchObject({ totalCost: 0, supplierId, ledgerTreatment: 'account' })
  expect(purchase.lines[0]).toMatchObject({ stockKind: 'bonus', baseQuantity: 200, costPerBase: 0 })
  await expect(page.getByRole('dialog')).toContainText('BONUS / SAMPLE · ZERO COST')
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  const after = await saved(page)
  expect(after.cashEntries).toEqual(before.cashEntries)
  expect(after.expenses).toEqual(before.expenses)
  expect(after.batches.at(-1)!.stockUnits).toBe(200)
  await selectSupplier(page)
  await expect(page.getByTestId('supplier-balance')).toHaveText('Rs. 0')
})

test('charges purchases, pays actual drawer cash, posts a supplier credit, and offsets the next invoice once', async ({
  page,
}) => {
  await openShift(page)
  await nav(page, 'Suppliers')
  const supplierId = await newSupplier(page)
  await receive(page, supplierId)
  const purchase = (await saved(page)).purchases.at(-1)!
  expect(purchase.totalCost).toBe(2500)
  expect((await saved(page)).cashEntries).toHaveLength(0)
  await selectSupplier(page)
  await expect(page.getByTestId('supplier-balance')).toHaveText('Rs. 25')
  await supplierCash(page, '25')
  await expect(page.getByTestId('supplier-balance')).toHaveText('Rs. 0')
  const d = await supplierReturn(page, 'PH3-PAID', '2')
  await expect(d.getByTestId('supplier-return-credit')).toHaveText('Rs. 10')
  await d.getByRole('button', { name: 'Confirm supplier return', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'SRET-0001', exact: true })).toContainText(
    'PH3-CREDIT',
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByTestId('supplier-balance')).toHaveText('Rs. 10')
  await expect(page.locator('.supplier-balance-box')).toContainText('Credit held by supplier')
  await receive(page, supplierId, 'PH3-NEXT', '6')
  await selectSupplier(page)
  await expect(page.getByTestId('supplier-balance')).toHaveText('Rs. 20')
  const state = await saved(page)
  expect(state.purchases.at(-1)!.totalCost).toBe(3000)
  expect(state.purchases.find((p) => p.id === purchase.id)).toEqual(purchase)
  expect(state.supplierReturns).toHaveLength(1)
  expect(state.cashEntries).toHaveLength(1)
  await nav(page, 'Cash drawer')
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 975')
  await expect(
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Cash movement journal', exact: true }) }),
  ).toContainText('SPAY-0001')
})

test('separates damaged shelf and quarantine returns from customer refund cash', async ({
  page,
}) => {
  const f = soldFixture()
  const state = recordSalesReturn(
    f.state,
    {
      saleId: f.sale.id,
      reason: 'Customer change',
      notes: '',
      confirmed: true,
      lines: [{ saleLineIndex: 0, baseQuantity: 2, disposition: 'quarantine' }],
    },
    'cashier',
    returnAt,
  )
  await load(page, state)
  await selectSupplier(page, 'Phase 2 sample supplier')
  const d = await supplierReturn(page, f.batch.number, '1')
  await d.getByLabel(`Supplier quarantine units for ${f.batch.number}`).fill('2')
  await d.getByRole('checkbox').check()
  await expect(d.getByTestId('supplier-return-credit')).toHaveText('Rs. 15')
  await d.getByRole('button', { name: 'Confirm supplier return', exact: true }).click()
  const after = await saved(page)
  expect(after.batches.at(-1)).toMatchObject({ stockUnits: 89, quarantinedUnits: 0 })
  expect(after.supplierReturns[0].lines[0]).toMatchObject({
    shelfUnits: 1,
    quarantinedUnits: 2,
    credit: 1500,
  })
  expect(after.cashEntries).toEqual(state.cashEntries)
  expect(after.sales).toEqual(state.sales)
  expect(after.purchases).toEqual(state.purchases)
})

test('expired-goods tab returns the exact expired batch to its original supplier without opening a cash shift', async ({
  page,
}) => {
  const before = await saved(page)
  const expired = before.batches.find((b) => b.number === 'DEMO-07-EXPIRED')!
  await nav(page, 'Expiry')
  await page.getByRole('button', { name: /Expired goods/ }).click()
  const row = page.getByRole('row').filter({ hasText: 'DEMO-07-EXPIRED' })
  await expect(row).toContainText('ORS sachet')
  await row.getByRole('button', { name: 'Supplier return', exact: true }).click()
  const d = page.getByRole('dialog')
  await expect(d.getByLabel('Supplier return reason')).toHaveValue('Expired')
  await d.getByLabel('Supplier shelf units for DEMO-07-EXPIRED').fill('1')
  await d.getByLabel('Supplier credit note reference').fill('EXPIRED-SAMPLE-CREDIT')
  await d.getByRole('checkbox').check()
  await d.getByRole('button', { name: 'Confirm supplier return', exact: true }).click()
  const after = await saved(page)
  expect(after.supplierReturns[0].supplierId).toBe(
    before.purchases.find((p) => p.id === expired.purchaseId)!.supplierId,
  )
  expect(after.batches.find((b) => b.id === expired.id)!.stockUnits).toBe(expired.stockUnits - 1)
  expect(after.cashEntries).toEqual([])
  expect(after.cashSessions).toEqual([])
})

test('configures three expiry windows/colors, rejects unordered thresholds and persists valid settings', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('far expiry days').fill('400')
  await page.getByLabel('middle expiry days').fill('200')
  await page.getByLabel('near expiry days').fill('200')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Near < middle < far')
  expect((await saved(page)).settings.expiry.nearDays).toBe(90)
  await page.getByLabel('near expiry days').fill('30')
  for (const [level, color] of [
    ['far', '#224466'],
    ['middle', '#886622'],
    ['near', '#aa3344'],
  ]) {
    await page.getByLabel(`${level} expiry color`).evaluate((node, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value)
      node.dispatchEvent(new Event('input', { bubbles: true }))
      node.dispatchEvent(new Event('change', { bubbles: true }))
    }, color)
  }
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await page.reload()
  expect((await saved(page)).settings.expiry).toEqual({
    farDays: 400,
    middleDays: 200,
    nearDays: 30,
    farColor: '#224466',
    middleColor: '#886622',
    nearColor: '#aa3344',
  })
  await nav(page, 'Expiry')
  await page.getByRole('button', { name: /Level 2 · Middle warning/ }).click()
  await expect(page.getByRole('row').filter({ hasText: 'DEMO-01A' })).toContainText(
    'Panadol 500 mg',
  )
  await expect(page.getByRole('button', { name: /Level 2 · Middle warning/ })).toHaveAttribute(
    'style',
    '--alert-color: #886622;',
  )
})

test('uses saleable stock for reorder and prepares a reviewed supplier-specific WhatsApp draft with no posting', async ({
  page,
}) => {
  const f = soldFixture()
  let state = recordSalesReturn(
    f.state,
    {
      saleId: f.sale.id,
      reason: 'Customer change',
      notes: '',
      confirmed: true,
      lines: [{ saleLineIndex: 0, baseQuantity: 2, disposition: 'quarantine' }],
    },
    'cashier',
    returnAt,
  )
  const supplierId = state.purchases.at(-1)!.supplierId
  state = editSupplier(
    state,
    supplierId,
    { name: 'Phase 2 sample supplier', agency: '', phone: '03001234567', address: '' },
    'owner',
  )
  await load(page, state)
  await nav(page, 'Reorder')
  await page.getByRole('button', { name: 'Configure product thresholds', exact: true }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Reorder policy product').selectOption(f.product.id)
  await d.getByLabel('Critical stock limit').fill('91')
  await d.getByLabel('Warning stock limit').fill('110')
  await d.getByLabel('Target stock level').fill('150')
  await d.getByLabel('Preferred reorder supplier').selectOption(supplierId)
  await d.getByRole('button', { name: 'Save reorder thresholds', exact: true }).click()
  await page.getByLabel('Reorder supplier filter').selectOption(supplierId)
  const row = page.getByRole('row').filter({ hasText: f.product.name })
  await expect(row).toContainText('CRITICAL')
  await expect(row).toContainText('90 tablets')
  await row.getByLabel(`Order ${f.product.name}`, { exact: true }).check()
  await expect(page.getByLabel(`Order base units for ${f.product.name}`)).toHaveValue('60')
  const before = await saved(page)
  await expect(page.getByLabel('Purchase request preview')).toContainText('60 tablets (base units)')
  await expect(page.getByText('Open WhatsApp Web', { exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await page.getByLabel(/I reviewed the supplier/).check()
  const link = page.getByRole('link', { name: 'Open WhatsApp Web', exact: true })
  const url = new URL((await link.getAttribute('href'))!)
  expect(url.origin + url.pathname).toBe('https://web.whatsapp.com/send')
  expect(url.searchParams.get('phone')).toBe('923001234567')
  expect(url.searchParams.get('text')).toBe(
    await page.getByLabel('Purchase request preview').inputValue(),
  )
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          ;(window as unknown as { copied: string }).copied = text
        },
      },
    }),
  )
  await page.getByRole('button', { name: 'Copy purchase request', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    url.searchParams.get('text'),
  )
  await page.getByLabel(`Order base units for ${f.product.name}`).fill('61')
  await expect(page.getByLabel(/I reviewed the supplier/)).not.toBeChecked()
  expect(await saved(page)).toEqual(before)
})

test('blocks duplicate accepted supplier credit references without removing more stock', async ({
  page,
}) => {
  await nav(page, 'Suppliers')
  const supplierId = await newSupplier(page)
  await receive(page, supplierId)
  await selectSupplier(page)
  let d = await supplierReturn(page, 'PH3-PAID', '1')
  await d.getByRole('button', { name: 'Confirm supplier return', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  const before = await saved(page)
  d = await supplierReturn(page, 'PH3-PAID', '1', ' ph3-credit ')
  await d.getByRole('button', { name: 'Confirm supplier return', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('credit note was already recorded')
  expect(await saved(page)).toEqual(before)
  await expect(
    page.getByRole('dialog', { name: 'Return goods to supplier', exact: true }),
  ).toBeVisible()
})

test('receives an actual supplier cash refund and shows its source number in the drawer', async ({
  page,
}) => {
  await openShift(page)
  await nav(page, 'Suppliers')
  await newSupplier(page, 'credit', '100')
  await selectSupplier(page)
  await supplierCash(page, '50', 'refund')
  await expect(page.getByTestId('supplier-balance')).toHaveText('Rs. 50')
  expect((await saved(page)).cashEntries[0]).toMatchObject({
    kind: 'supplier-refund',
    amount: 5000,
  })
  await nav(page, 'Cash drawer')
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 1,050')
  await expect(
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Cash movement journal', exact: true }) }),
  ).toContainText('SPAY-0001')
})

test('genuine V2 migration preserves sale/hold data, leaves historical debt unknown and offers original download', async ({
  page,
}) => {
  const f = soldFixture()
  const old = toV2(f.state)
  const raw = JSON.stringify(old, null, 2)
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw })
  await page.reload()
  const current = await saved(page)
  expect(toV2(current)).toEqual({ ...old, revision: old.revision + 1 })
  expect(await page.evaluate((k) => localStorage.getItem(k), PHASE2_BACKUP_KEY)).toBe(raw)
  await selectSupplier(page, 'Phase 2 sample supplier')
  await expect(page.getByTestId('supplier-balance')).toHaveText('Needs reconciliation')
  await expect(
    page.getByRole('button', { name: 'Record cash settlement', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Confirm current statement balance', exact: true }).click()
  const d = page.getByRole('dialog')
  await expect(d.getByLabel('Current supplier statement balance')).toHaveValue('')
  await d.getByLabel('Current supplier statement balance').fill('125')
  await d.getByLabel('Supplier statement note').fill('Sample current supplier statement verified')
  await d.getByRole('checkbox').check()
  await d.getByRole('button', { name: 'Confirm supplier balance', exact: true }).click()
  await expect(page.getByTestId('supplier-balance')).toHaveText('Rs. 125')
  expect((await saved(page)).cashEntries).toEqual(old.cashEntries)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download original Phase 2', exact: true }).click()
  expect((await download).suggestedFilename()).toContain('original-phase-2')
  expect(await page.evaluate((k) => localStorage.getItem(k), PHASE2_BACKUP_KEY)).toBe(raw)
})

test('failed storage keeps supplier credit, stock and sequence unchanged; the same open request can be retried', async ({
  page,
}) => {
  await nav(page, 'Suppliers')
  const supplierId = await newSupplier(page)
  await receive(page, supplierId)
  await selectSupplier(page)
  const d = await supplierReturn(page, 'PH3-PAID', '2')
  const before = await saved(page)
  await page.evaluate((k) => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { restoreStorage: () => void }).restoreStorage = () => {
      Storage.prototype.setItem = original
    }
    Storage.prototype.setItem = function (key, value) {
      if (key === k) throw new DOMException('Quota', 'QuotaExceededError')
      original.call(this, key, value)
    }
  }, key)
  await d.getByRole('button', { name: 'Confirm supplier return', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Nothing was changed')
  expect(await saved(page)).toEqual(before)
  await expect(d).toBeVisible()
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage())
  await d.getByRole('button', { name: 'Confirm supplier return', exact: true }).click()
  const after = await saved(page)
  expect(after.supplierReturns).toHaveLength(1)
  expect(after.nextSupplierReturnNumber).toBe(2)
  expect(after.supplierReturns[0].totalCredit).toBe(1000)
})

test('management-only stock pages and dialogs close safely on a cashier role change', async ({
  page,
}) => {
  await nav(page, 'Suppliers')
  await page.getByRole('button', { name: 'New supplier', exact: true }).click()
  await page.getByLabel('Test role').selectOption('cashier')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
  for (const name of ['Suppliers', 'Expiry', 'Reorder'])
    await expect(
      page
        .getByRole('navigation', {
          name:
            (page.viewportSize()?.width ?? 1440) <= 800 ? 'Mobile navigation' : 'Main navigation',
          exact: true,
        })
        .getByRole('button', { name, exact: true }),
    ).toBeDisabled()
})

test('Phase 3 pages and supplier dialogs pass automated accessibility checks', async ({ page }) => {
  const check = async () =>
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  for (const name of ['Suppliers', 'Expiry', 'Reorder']) {
    await nav(page, name)
    await check()
  }
  await nav(page, 'Suppliers')
  for (const name of ['New supplier', 'Return goods to supplier', 'Record cash settlement']) {
    await page.getByRole('button', { name, exact: true }).click()
    await check()
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  }
  await nav(page, 'Reorder')
  await page.getByRole('button', { name: 'Configure product thresholds', exact: true }).click()
  await check()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await check()
})

test('Phase 3 remains usable at narrow phone width without horizontal page or dialog overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const check = async () =>
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  for (const name of ['Suppliers', 'Expiry', 'Reorder', 'Stock in']) {
    await nav(page, name)
    await check()
  }
  await nav(page, 'Suppliers')
  await page.getByRole('button', { name: 'Return goods to supplier', exact: true }).click()
  await check()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await nav(page, 'Reorder')
  await page.getByRole('button', { name: 'Configure product thresholds', exact: true }).click()
  await check()
  expect(errors).toEqual([])
})
