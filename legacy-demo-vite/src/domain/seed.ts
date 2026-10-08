import { type AppState, type ProductInput, shiftDate, DEFAULT_EXPIRY } from './model'
import { createProduct, receiveStock } from './operations'

const examples: [
  string,
  string,
  ProductInput['category'],
  ProductInput['baseUnit'],
  number,
  number,
  number,
  number,
  number,
][] = [
  ['Panadol 500 mg', 'Paracetamol · sample product', 'Tablets', 'tablet', 10, 10, 500, 675, 8],
  ['Augmentin 625 mg', 'Co-amoxiclav · sample product', 'Tablets', 'tablet', 7, 2, 3500, 4500, 4],
  ['Brufen 400 mg', 'Ibuprofen · sample product', 'Tablets', 'tablet', 10, 10, 1200, 1600, 3],
  ['Zyrtec 10 mg', 'Cetirizine · sample product', 'Tablets', 'tablet', 10, 1, 2000, 2750, 12],
  ['Nexum 20 mg', 'Esomeprazole · sample product', 'Capsules', 'capsule', 7, 2, 1800, 2500, 5],
  [
    'Gaviscon 120 ml',
    'Oral suspension · sample bottle',
    'Liquids',
    'piece',
    1,
    12,
    46500,
    55000,
    2,
  ],
  ['ORS sachet', 'Oral rehydration salts · sample', 'Essentials', 'piece', 1, 25, 2500, 4000, 3],
  ['Calpol 60 ml', 'Oral suspension · sample bottle', 'Liquids', 'piece', 1, 12, 12000, 14500, 2],
  ['Glucophage 500 mg', 'Metformin · sample product', 'Tablets', 'tablet', 10, 10, 800, 1200, 3],
  ['Vitamin C 500 mg', 'Ascorbic acid · sample product', 'Tablets', 'tablet', 10, 3, 1450, 2000, 5],
  ['Dettol 100 ml', 'Antiseptic · sample bottle', 'Essentials', 'piece', 1, 12, 19000, 24500, 2],
  ['Cotton bandage', 'First aid · sample piece', 'Essentials', 'piece', 1, 10, 6500, 9500, 4],
]

export function createSeedState(today: string): AppState {
  let state: AppState = {
    schemaVersion: 3,
    revision: 0,
    nextPurchaseNumber: 1,
    nextSaleNumber: 1,
    nextReturnNumber: 1,
    nextProvisionalNumber: 1,
    nextCashSessionNumber: 1,
    nextExpenseNumber: 1,
    nextOwnerEntryNumber: 1,
    nextSupplierReturnNumber: 1,
    nextSupplierSettlementNumber: 1,
    nextSupplierLedgerOrder: 1,
    suppliers: [],
    supplierReturns: [],
    supplierSettlements: [],
    cartDiscountMode: 'margin',
    cartDiscountBps: 0,
    cartPhone: '',
    salesReturns: [],
    provisionalReturns: [],
    cashSessions: [],
    cashEntries: [],
    expenses: [],
    ownerEntries: [],
    products: [],
    batches: [],
    purchases: [],
    sales: [],
    cart: [],
    parkedCarts: [],
    settings: {
      name: 'Area11 Demo Pharmacy',
      address: 'Sample store · not a real shop',
      phone: '',
      footer: 'Thank you. This is a sample-data receipt.',
      paperWidth: 80,
      discountMode: 'margin',
      cashierMaxDiscountBps: 1000,
      expiry: { ...DEFAULT_EXPIRY },
    },
  }
  examples.forEach(
    ([name, description, category, baseUnit, unitsPerStrip, stripsPerBox], index) => {
      const prefix = 110000000010 + index * 10
      state = createProduct(
        state,
        {
          name,
          description,
          category,
          baseUnit,
          unitsPerStrip,
          stripsPerBox,
          barcodes: {
            loose: String(prefix + 1),
            strip: unitsPerStrip > 1 ? String(prefix + 2) : '',
            box: String(prefix + 3),
          },
        },
        'owner',
      )
    },
  )
  state = receiveStock(
    state,
    {
      supplier: 'Medix Distribution (sample)',
      reference: 'DEMO-DELIVERY-01',
      lines: examples.map((example, index) => ({
        productId: state.products[index].id,
        unit: 'box',
        quantity: example[8],
        batchNumber: `DEMO-${String(index + 1).padStart(2, '0')}A`,
        expiresOn: shiftDate(today, index === 0 ? 45 : 120 + index * 24),
        costPerBase: example[6],
        pricePerBase: example[7],
      })),
    },
    'owner',
    `${shiftDate(today, -5)}T05:00:00.000Z`,
  )
  state = receiveStock(
    state,
    {
      supplier: 'Care Supply Co. (sample)',
      reference: 'DEMO-DELIVERY-02',
      lines: [
        {
          productId: state.products[0].id,
          unit: 'box',
          quantity: 3,
          batchNumber: 'DEMO-01B',
          expiresOn: shiftDate(today, 210),
          costPerBase: 525,
          pricePerBase: 700,
        },
        {
          productId: state.products[1].id,
          unit: 'box',
          quantity: 3,
          batchNumber: 'DEMO-02B',
          expiresOn: shiftDate(today, 280),
          costPerBase: 3700,
          pricePerBase: 4700,
        },
        {
          productId: state.products[6].id,
          unit: 'box',
          quantity: 1,
          batchNumber: 'DEMO-07-EXPIRED',
          expiresOn: shiftDate(today, -10),
          costPerBase: 2400,
          pricePerBase: 3500,
        },
      ],
    },
    'owner',
    `${shiftDate(today, -2)}T06:00:00.000Z`,
  )
  return state
}
