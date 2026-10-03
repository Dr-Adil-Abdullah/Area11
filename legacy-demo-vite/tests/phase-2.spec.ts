import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { AppState } from '../src/domain/model'
import { toLegacy, soldFixture } from './fixtures'
import { MIGRATION_BACKUP_KEY } from '../src/data/migrations'

const key = 'area11.phase1.workspace.v1'
const saved = (page: Page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)!) as AppState, key)
const nav = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name, exact: true })
    .click()
async function openShift(page: Page, float = '1000') {
  await nav(page, 'Cash drawer')
  await page.getByLabel('Cash operator label').fill('Morning sample operator')
  await page.getByLabel('Opening float', { exact: true }).fill(float)
  await page.getByRole('button', { name: 'Open cash shift', exact: true }).click()
  await expect(page.getByTestId('drawer-expected')).toHaveText(
    `Rs. ${Number(float).toLocaleString('en-PK')}`,
  )
  await nav(page, 'Counter')
}
async function addPanadol(page: Page) {
  await page.getByRole('button', { name: 'Select Panadol 500 mg', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add to sale', exact: true }).click()
}
async function finish(page: Page) {
  await page.getByRole('button', { name: 'Checkout', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sale', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sale receipt' })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
}
async function provisional(page: Page, refund: string, units = '10') {
  await nav(page, 'Returns')
  await page.getByRole('button', { name: 'Provisional return', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const p = (await saved(page)).products.find((p) => p.name === 'Panadol 500 mg')!
  await dialog.getByLabel('Provisional product 1').selectOption(p.id)
  await dialog.getByLabel('Provisional base units 1').fill(units)
  await dialog.getByLabel('Provisional cash refunded').fill(refund)
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Save provisional refund', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}
async function linkPending(page: Page, settlement?: 'expense') {
  await page.getByRole('button', { name: 'Verify & link bill', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const sale = (await saved(page)).sales[0]
  await dialog.getByLabel('Original invoice', { exact: true }).selectOption(sale.id)
  await dialog.getByLabel('Return base units for line 1').fill('10')
  if (settlement) await dialog.getByLabel('Overpayment settlement').selectOption('expense')
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Link original bill', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'RET-0001', exact: true })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
})

test('requires an explicit opening float and records net sale cash, not tendered cash', async ({
  page,
}) => {
  await addPanadol(page)
  await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeDisabled()
  await expect(page.locator('.cash-shift-prompt')).toContainText('Cash shift not open')
  expect((await saved(page)).cashSessions).toHaveLength(0)
  await openShift(page)
  await page.getByRole('button', { name: 'Checkout', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Cash received').fill('100')
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sale', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('Receipt preview')).toContainText('Rs. 40')
  const state = await saved(page)
  expect(state.sales[0].total).toBe(6000)
  expect(state.sales[0].tendered).toBe(10000)
  expect(state.cashEntries[0].amount).toBe(6000)
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await nav(page, 'Cash drawer')
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 1,060')
})

test('links a partial return to the original batch, quarantines goods and preserves the invoice', async ({
  page,
}) => {
  await openShift(page)
  await addPanadol(page)
  await finish(page)
  const original = (await saved(page)).sales[0]
  await page.getByLabel('Test role').selectOption('cashier')
  await nav(page, 'Returns')
  await page.getByRole('button', { name: 'Return items', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Return stock disposition')).toBeDisabled()
  await dialog.getByLabel('Return base units for line 1').fill('2')
  await expect(dialog.getByTestId('return-refund')).toHaveText('Rs. 12')
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: 'Confirm return & refund', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'RET-0001', exact: true })).toBeVisible()
  let state = await saved(page)
  expect(state.sales[0]).toEqual(original)
  expect(state.salesReturns[0].refund).toBe(1200)
  const batch = state.batches.find((b) => b.id === original.lines[0].batchId)!
  expect(batch.stockUnits).toBe(792)
  expect(batch.quarantinedUnits).toBe(2)
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  state = await saved(page)
  expect(state.salesReturns[0].number).toBe('RET-0001')
  await nav(page, 'Cash drawer')
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 1,048')
})

test('pending alerts persist across screens/reload and Manager matches a bill without a duplicate payout', async ({
  page,
}) => {
  await openShift(page)
  await addPanadol(page)
  await finish(page)
  await page.getByLabel('Test role').selectOption('cashier')
  const before = await saved(page)
  await provisional(page, '60')
  await expect(page.getByRole('button', { name: 'Pending returns: 1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Verify & link bill', exact: true })).toBeDisabled()
  await nav(page, 'Counter')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Pending returns: 1', exact: true })).toBeVisible()
  await nav(page, 'Returns')
  expect((await saved(page)).batches).toEqual(before.batches)
  await page.getByLabel('Test role').selectOption('manager')
  const beforeLink = await saved(page)
  await linkPending(page)
  const after = await saved(page)
  expect(after.cashEntries).toEqual(beforeLink.cashEntries)
  expect(after.provisionalReturns[0].linkedReturnId).toBe(after.salesReturns[0].id)
  expect(after.salesReturns[0].settlement).toBe('matched')
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pending returns: 1', exact: true })).toHaveCount(0)
  await expect(page.locator('.pending-card')).toHaveCount(0)
  await nav(page, 'Cash drawer')
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 1,000')
})

test('Owner explicitly absorbs an overpayment as an expense without deducting cash twice', async ({
  page,
}) => {
  await openShift(page)
  await addPanadol(page)
  await finish(page)
  await provisional(page, '70')
  const before = await saved(page)
  await linkPending(page, 'expense')
  const after = await saved(page)
  expect(after.cashEntries).toEqual(before.cashEntries)
  expect(after.expenses[0]).toMatchObject({
    amount: 1000,
    payment: 'adjustment',
    kind: 'return-adjustment',
  })
  await expect(page.getByRole('dialog')).toContainText('no second cash deduction')
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  await nav(page, 'Cash drawer')
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 990')
})

test('handover records a shortage, carries actual counted float and permits a final close', async ({
  page,
}) => {
  await openShift(page)
  await addPanadol(page)
  await finish(page)
  await nav(page, 'Cash drawer')
  await expect(page.getByLabel('Actual cash counted', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Close cash shift', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Shift handover', exact: true }).click()
  await page.getByLabel('Actual cash counted', { exact: true }).fill('1050')
  await page.getByLabel('Next cash operator').fill('Evening sample operator')
  await page.getByLabel('Cash closing note').fill('Sample Rs 10 shortage recorded')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Complete handover', exact: true }).click()
  let state = await saved(page)
  expect(state.cashSessions[0]).toMatchObject({
    counted: 105000,
    expectedAtClose: 106000,
    variance: -1000,
    status: 'closed',
  })
  expect(state.cashSessions[1]).toMatchObject({
    opening: 105000,
    status: 'open',
    operator: 'Evening sample operator',
  })
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 1,050')
  await page.getByRole('button', { name: 'Final closing', exact: true }).click()
  await expect(page.getByLabel('Actual cash counted', { exact: true })).toHaveValue('')
  await page.getByLabel('Actual cash counted', { exact: true }).fill('1050')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Close cash shift', exact: true }).click()
  state = await saved(page)
  expect(state.cashSessions.every((s) => s.status === 'closed')).toBe(true)
  expect(state.cashSessions[1].variance).toBe(0)
  await expect(page.getByTestId('drawer-expected')).toHaveText('Not open')
})

test('owner drawings, cash repayment, medicine-at-cost and shop expenses stay separate', async ({
  page,
}) => {
  await openShift(page)
  await nav(page, 'Accounts')
  await page.getByLabel('Owner cash amount').fill('100')
  await page.getByLabel('Owner entry description').fill('Sample personal cash use')
  await page.getByRole('button', { name: 'Record owner entry', exact: true }).click()
  await page.getByLabel('Owner entry type').selectOption('cash-deposit')
  await page.getByLabel('Owner cash amount').fill('40')
  await page.getByLabel('Owner entry description').fill('Sample cash returned')
  await page.getByRole('button', { name: 'Record owner entry', exact: true }).click()
  await page.getByLabel('Owner entry type').selectOption('medicine-use')
  const state = await saved(page)
  const batch = state.batches.find((b) => b.number === 'DEMO-01A')!
  await page.getByLabel('Owner medicine batch').selectOption(batch.id)
  await page.getByLabel('Owner medicine quantity').fill('2')
  await page.getByLabel('Owner entry description').fill('Sample personal medicine use')
  await page.getByRole('button', { name: 'Record owner entry', exact: true }).click()
  await expect(page.getByTestId('owner-balance')).toHaveText('Rs. 70')
  await page.getByRole('button', { name: 'Shop expenses', exact: true }).click()
  await page.getByLabel('Expense category').fill('Tea')
  await page.getByLabel('Expense amount').fill('5')
  await page.getByRole('button', { name: 'Record expense', exact: true }).click()
  const after = await saved(page)
  expect(after.ownerEntries.map((e) => e.amount)).toEqual([10000, 4000, 1000])
  expect(after.sales).toHaveLength(0)
  expect(after.expenses[0].amount).toBe(500)
  expect(after.batches.find((b) => b.id === batch.id)!.stockUnits).toBe(batch.stockUnits - 2)
  await page.getByLabel('Test role').selectOption('manager')
  await expect(
    page.getByRole('button', { name: 'Owner drawing account', exact: true }),
  ).toHaveCount(0)
  await nav(page, 'Cash drawer')
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 935')
  await page.getByLabel('Test role').selectOption('cashier')
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('button', { name: 'Accounts', exact: true }),
  ).toBeDisabled()
})

test('Owner/Manager configure discount policy; held percentage and phone follow the exact batch', async ({
  page,
}) => {
  await openShift(page)
  await addPanadol(page)
  await page.getByLabel('Add receipt phone').click()
  await page.getByRole('dialog').getByLabel('Receipt lookup phone').fill('03001234567')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save receipt phone', exact: true })
    .click()
  await page.getByRole('button', { name: 'Discount 0%', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Discount percentage').fill('10')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Apply discount', exact: true })
    .click()
  const quoted = await saved(page)
  await page.getByRole('button', { name: 'Park current cart', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Park this sale/ })
    .click()
  await page.getByRole('button', { name: /Parked carts/, exact: false }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Resume', exact: true }).click()
  const resumed = await saved(page)
  expect(resumed.cart).toEqual(quoted.cart)
  expect(resumed.cartPhone).toBe('03001234567')
  expect(resumed.cartDiscountBps).toBe(1000)
  await finish(page)
  await nav(page, 'Returns')
  await page.getByLabel('Receipt phone search').fill('300123')
  await expect(page.getByRole('button', { name: 'Return items', exact: true })).toHaveCount(1)
  const sale = (await saved(page)).sales[0]
  expect(sale.discount).toBe(175)
  expect(sale.customerPhone).toBe('03001234567')
  await page.getByLabel('Test role').selectOption('manager')
  await page.locator('.sidebar').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Discount calculation').selectOption('retail')
  await page.getByLabel('Cashier maximum discount').fill('5')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  expect((await saved(page)).settings).toMatchObject({
    discountMode: 'retail',
    cashierMaxDiscountBps: 500,
  })
})

test('genuine Phase 1 data upgrades with exact original backup and no invented legacy cash', async ({
  page,
}) => {
  const legacy = toLegacy(soldFixture().state)
  const raw = JSON.stringify({ ...legacy, revision: 28 }, null, 2)
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
  const state = await saved(page)
  expect(state.schemaVersion).toBe(3)
  expect(state.revision).toBe(29)
  expect(state.sales[0].total).toBe(legacy.sales[0].total)
  expect(state.sales[0].id).toBe(legacy.sales[0].id)
  expect(state.cashSessions).toEqual([])
  expect(state.cashEntries).toEqual([])
  expect(await page.evaluate((k) => localStorage.getItem(k), MIGRATION_BACKUP_KEY)).toBe(raw)
  await nav(page, 'Receipts')
  await page.getByRole('button', { name: 'View receipt', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('Receipt preview')).toContainText(
    legacy.sales[0].number,
  )
})

test('financial pages, refund/provisional dialogs and discount controls pass automated accessibility checks', async ({
  page,
}) => {
  await openShift(page)
  await addPanadol(page)
  await finish(page)
  for (const label of ['Cash drawer', 'Returns', 'Accounts']) {
    await nav(page, label)
    expect((await new AxeBuilder({ page }).analyze()).violations, `${label} accessibility`).toEqual(
      [],
    )
  }
  await nav(page, 'Returns')
  await page.getByRole('button', { name: 'Return items', exact: true }).click()
  await page.getByLabel('Return base units for line 1').fill('1')
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    'Return dialog accessibility',
  ).toEqual([])
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: 'Provisional return', exact: true }).click()
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    'Provisional dialog accessibility',
  ).toEqual([])
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await nav(page, 'Counter')
  await addPanadol(page)
  await page.getByRole('button', { name: 'Discount 0%', exact: true }).click()
  expect(
    (await new AxeBuilder({ page }).analyze()).violations,
    'Discount dialog accessibility',
  ).toEqual([])
})

test('cash and return workflows remain usable on a narrow mobile screen without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = page.getByRole('navigation', { name: 'Mobile navigation', exact: true })
  await mobile.getByRole('button', { name: 'Cash drawer', exact: true }).click()
  await page.getByLabel('Cash operator label').fill('Mobile sample operator')
  await page.getByLabel('Opening float', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Open cash shift', exact: true }).click()
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 100')
  await mobile.getByRole('button', { name: 'Returns', exact: true }).click()
  await page.getByRole('button', { name: 'Provisional return', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  const width = await page.getByRole('dialog').evaluate((e) => e.scrollWidth <= e.clientWidth)
  expect(width).toBe(true)
})

test('Manager settles only an underpaid refund difference, not the full refund a second time', async ({
  page,
}) => {
  await openShift(page)
  await addPanadol(page)
  await finish(page)
  await provisional(page, '50')
  await page.getByLabel('Test role').selectOption('manager')
  await linkPending(page)
  const state = await saved(page)
  expect(state.cashEntries.at(-1)).toMatchObject({ kind: 'return-settlement', amount: -1000 })
  expect(state.salesReturns[0].refund).toBe(6000)
  expect(state.salesReturns[0].cashDifference).toBe(-1000)
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  await nav(page, 'Cash drawer')
  await expect(page.getByTestId('drawer-expected')).toHaveText('Rs. 1,000')
})

test('retail discounts below cost are locked even for Owner; Cashier cannot exceed the configured limit', async ({
  page,
}) => {
  await openShift(page)
  await page.locator('.sidebar').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Discount calculation').selectOption('retail')
  await page.getByLabel('Cashier maximum discount').fill('5')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await nav(page, 'Counter')
  await addPanadol(page)
  await page.getByRole('button', { name: 'Discount 0%', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Discount percentage').fill('30')
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Apply discount', exact: true }),
  ).toBeDisabled()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('below purchase cost')
  expect((await saved(page)).cartDiscountBps).toBe(0)
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByLabel('Test role').selectOption('cashier')
  await page.getByRole('button', { name: 'Discount 0%', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Discount percentage').fill('10')
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Apply discount', exact: true }),
  ).toBeDisabled()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('cashier discount limit')
})

test('Owner can download the exact saved snapshot for recovery before any reset', async ({
  page,
}) => {
  const before = await page.evaluate((k) => localStorage.getItem(k), key)
  await page.locator('.sidebar').getByRole('button', { name: 'Settings', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download saved snapshot', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^area11-recovery-snapshot-\d{4}-\d{2}-\d{2}\.json$/)
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks).toString('utf8')).toBe(before)
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before)
})
