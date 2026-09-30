import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { AppState } from '../src/domain/model'

declare global {
  interface Window {
    printCalls: number
  }
}

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('area11.phase1.workspace.v1')!) as AppState)
const nav = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name, exact: true })
    .click()
async function addProductToCart(page: Page, name: string) {
  await page.getByRole('button', { name: `Select ${name}`, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add to sale', exact: true }).click()
}
async function finishSale(page: Page) {
  await page.getByRole('button', { name: 'Checkout', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Complete sale', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Sale receipt' })).toBeVisible()
}
async function registerAndReceive(
  page: Page,
  name: string,
  cost: string,
  price: string,
  packs: string,
  inner: string,
  qty: string,
) {
  await nav(page, 'Stock in')
  await page.getByRole('button', { name: 'New product', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/Product name/).fill(name)
  await dialog.getByLabel('Strips / inner packs per box').fill(packs)
  await dialog.getByLabel('Base units per strip / inner pack').fill(inner)
  await dialog.getByRole('button', { name: 'Register product', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'New supplier', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Supplier profile name').fill('E2E Sample Supplier')
  await page.getByRole('dialog').getByLabel('Supplier starting balance', { exact: true }).fill('0')
  await page.getByRole('dialog').getByRole('checkbox').check()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create supplier', exact: true })
    .click()
  await page.getByLabel('Quantity for stock item 1').fill(qty)
  await page.getByLabel('Batch number for stock item 1').fill('E2E-BATCH')
  await page.getByLabel('Expiry date for stock item 1').fill('2030-12-31')
  await page.getByLabel('Cost per base unit for stock item 1').fill(cost)
  await page.getByLabel('Retail per base unit for stock item 1').fill(price)
  await page.getByRole('button', { name: 'Receive & save stock', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'PINV-0003', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
  await nav(page, 'Cash drawer')
  await page.getByLabel('Cash operator label').fill('E2E operator')
  await page.getByLabel('Opening float', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Open cash shift', exact: true }).click()
  await nav(page, 'Counter')
})

test('opens a clear demo workspace with no runtime errors and meaningful test roles', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.locator('.product-card')).toHaveCount(12)
  await expect(page.getByText('Sample data only.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeDisabled()
  await page.getByLabel('Test role').selectOption('cashier')
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true })
  await expect(navigation.getByRole('button', { name: 'Inventory', exact: true })).toBeDisabled()
  await expect(navigation.getByRole('button', { name: 'Stock in', exact: true })).toBeDisabled()
  await page.getByLabel('Test role').selectOption('manager')
  await nav(page, 'Inventory')
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible()
  await page.getByLabel('Test role').selectOption('cashier')
  await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('registers inside stock entry, receives 5 boxes = 100 tablets, bills one strip and retains it on reload', async ({
  page,
}) => {
  await registerAndReceive(page, 'E2E tablets', '5', '7', '2', '10', '5')
  let state = await saved(page)
  const product = state.products.find((p) => p.name === 'E2E tablets')!
  const batch = state.batches.find((b) => b.productId === product.id)!
  expect(batch.stockUnits).toBe(100)
  expect(state.purchases.at(-1)!.lines[0].baseQuantity).toBe(100)
  await nav(page, 'Counter')
  await addProductToCart(page, 'E2E tablets')
  await expect(page.getByTestId('cart-total')).toHaveText('Rs. 70')
  await page.getByRole('button', { name: 'Checkout', exact: true }).click()
  await page.getByLabel('Cash received', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Complete sale', exact: true }).click()
  const receipt = page.getByRole('dialog', { name: 'Sale receipt', exact: true })
  await expect(receipt.getByLabel('Receipt preview')).toContainText('INV-0001')
  await expect(receipt.getByLabel('Receipt preview')).toContainText('1 strip')
  await expect(receipt.getByLabel('Receipt preview')).toContainText('Rs. 30')
  await receipt.getByRole('button', { name: '58mm', exact: true }).click()
  await expect(receipt.getByLabel('Receipt preview')).toHaveClass(/paper-58/)
  await receipt.getByRole('button', { name: '80mm', exact: true }).click()
  await expect(receipt.getByLabel('Receipt preview')).toHaveClass(/paper-80/)
  await receipt.getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  state = await saved(page)
  expect(state.batches.find((b) => b.id === batch.id)!.stockUnits).toBe(90)
  expect(state.sales).toHaveLength(1)
  expect(state.nextSaleNumber).toBe(2)
  await nav(page, 'Receipts')
  await page.getByRole('button', { name: 'View receipt', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('Receipt preview')).toContainText('INV-0001')
})

test('supports keyboard scanner barcodes for individual, strip and box packs', async ({ page }) => {
  const input = page.getByLabel('Search products or scan barcode', { exact: true })
  for (const code of ['110000000011', '110000000012', '110000000013']) {
    await input.fill(code)
    await input.press('Enter')
  }
  const state = await saved(page)
  expect(state.cart.map((l) => l.unit)).toEqual(['loose', 'strip', 'box'])
  expect(new Set(state.cart.map((l) => l.batchId)).size).toBe(1)
  await page.keyboard.press('F2')
  await expect(input).toBeFocused()
  await page.reload()
  expect((await saved(page)).cart).toHaveLength(3)
})

test('parks a batch-specific cart, completes another sale and resumes the original', async ({
  page,
}) => {
  await addProductToCart(page, 'Panadol 500 mg')
  const original = (await saved(page)).cart
  await page.keyboard.press('F4')
  await page
    .getByRole('dialog')
    .getByLabel(/Label for current cart/)
    .fill('Customer A')
  await page.getByRole('button', { name: /Park this sale/ }).click()
  expect((await saved(page)).cart).toHaveLength(0)
  expect((await saved(page)).parkedCarts).toHaveLength(1)
  await addProductToCart(page, 'ORS sachet')
  await finishSale(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: /Parked carts/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Resume', exact: true }).click()
  const state = await saved(page)
  expect(state.cart).toEqual(original)
  expect(state.parkedCarts).toHaveLength(0)
  expect(state.sales).toHaveLength(1)
  await expect(page.locator('.cart-heading')).toContainText('INV-0002')
})

test('never permits selection of an expired batch', async ({ page }) => {
  await page.getByRole('button', { name: 'Select ORS sachet', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: /DEMO-07-EXPIRED/ })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: /DEMO-07A/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await dialog.getByRole('button', { name: 'Add to sale', exact: true }).click()
  const state = await saved(page)
  const chosen = state.batches.find((b) => b.id === state.cart[0].batchId)!
  expect(chosen.number).toBe('DEMO-07A')
})

test('applies the confirmed 545/543 cost-protection exception in the UI and receipt', async ({
  page,
}) => {
  await registerAndReceive(page, 'Cost protected sample', '543', '545', '1', '1', '1')
  await nav(page, 'Counter')
  await addProductToCart(page, 'Cost protected sample')
  await expect(page.getByTestId('cart-total')).toHaveText('Rs. 545')
  await expect(page.locator('.cost-protection')).toContainText('Rounding skipped')
  await finishSale(page)
  await expect(page.getByRole('dialog').getByLabel('Receipt preview')).toContainText(
    'Rounding skipped',
  )
  const sale = (await saved(page)).sales[0]
  expect(sale.subtotal).toBe(54500)
  expect(sale.total).toBe(54500)
  expect(sale.rounding).toBe(0)
})

test('preserves unreadable saved data and requires an explicit Owner reset', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('area11.phase1.workspace.v1', '{invalid'))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('could not be loaded')
  expect(await page.evaluate(() => localStorage.getItem('area11.phase1.workspace.v1'))).toBe(
    '{invalid',
  )
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Reset sample workspace', exact: true }),
  ).toBeDisabled()
  await page.getByRole('dialog').getByLabel('Type RESET to confirm').fill('RESET')
  await page.getByRole('button', { name: 'Reset sample workspace', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Point of sale', exact: true })).toBeVisible()
  expect((await saved(page)).products).toHaveLength(12)
})

test('works at Android-sized widths without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await addProductToCart(page, 'Panadol 500 mg')
  await page.getByRole('button', { name: /View cart/ }).click()
  await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeVisible()
  await finishSale(page)
  const width = await page.getByRole('dialog').evaluate((el) => el.getBoundingClientRect().width)
  expect(width).toBeLessThan(390)
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Mobile navigation', exact: true })
    .getByRole('button', { name: 'Receipts', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Sale receipts', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('prints the selected thermal width without creating a duplicate sale', async ({ page }) => {
  await addProductToCart(page, 'Panadol 500 mg')
  await finishSale(page)
  await page.evaluate(() => {
    window.printCalls = 0
    window.print = () => {
      window.printCalls += 1
    }
  })
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '58mm', exact: true }).click()
  await dialog.getByRole('button', { name: 'Print receipt', exact: true }).click()
  expect(await page.evaluate(() => window.printCalls)).toBe(1)
  expect((await saved(page)).sales).toHaveLength(1)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#receipt-print')).toBeVisible()
  await expect(page.locator('#root')).toBeHidden()
  const paperWidth = await page
    .locator('#receipt-print .receipt-paper')
    .evaluate((el) => el.getBoundingClientRect().width)
  expect(paperWidth).toBeCloseTo((58 * 96) / 25.4, 0)
  await page.emulateMedia({ media: 'screen' })
  await dialog.getByRole('button', { name: '80mm', exact: true }).click()
  await page.emulateMedia({ media: 'print' })
  const wide = await page
    .locator('#receipt-print .receipt-paper')
    .evaluate((el) => el.getBoundingClientRect().width)
  expect(wide).toBeCloseTo((80 * 96) / 25.4, 0)
  const pdf = await page.pdf({ width: '80mm', height: '200mm', printBackground: true })
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
  expect(pdf.length).toBeGreaterThan(5000)
})

test('passes automated accessibility checks on the counter, key dialogs and stock screens', async ({
  page,
}) => {
  async function check() {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  }
  await check()
  await page.getByRole('button', { name: 'Select Panadol 500 mg', exact: true }).click()
  await check()
  await page.getByRole('button', { name: 'Add to sale', exact: true }).click()
  await page.getByRole('button', { name: 'Checkout', exact: true }).click()
  await check()
  await page.getByRole('button', { name: 'Complete sale', exact: true }).click()
  await check()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  for (const name of ['Inventory', 'Stock in', 'Receipts']) {
    await nav(page, name)
    await check()
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await check()
})
