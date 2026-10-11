// ─────────────────────────────────────────────────────────────────────────────
// Business profiles — the single source of truth for HOW EACH KIND OF BUSINESS
// WORKS in this app.
//
// A salon, a hardware store and a restaurant do not run the same way, so every
// screen asks this file instead of hard-coding "if barbershop…":
//   • vocabulary   – what things are called ("Menu" vs "Medicines" vs "Collection")
//   • modules      – which pages exist for that business
//   • products     – categories + the extra fields each item needs
//                    (expiry & batch for pharmacy, IMEI for phones, size for clothes…)
//   • sale         – extra questions at the till (table number, patient name, delivery…)
//   • services     – walk-in / booking / repair-job workflow for service businesses
//   • expenses     – the running costs that business actually has
//   • dashboard    – which "what needs my attention" cards matter
//
// To add a new kind of business, add ONE entry here (+ the value to the
// businesses_type_check constraint in the database). No page needs editing.
// ─────────────────────────────────────────────────────────────────────────────

// ── Reusable pieces ──────────────────────────────────────────────────────────

const COMMON_EXPENSES = [
  'Rent',
  'Salaries / wages',
  'Electricity (UMEME)',
  'Water',
  'Transport',
  'Airtime & data',
  'Licences & taxes',
  'Mobile money charges',
  'Repairs & maintenance',
  'Security',
  'Marketing',
  'Other',
]

const brandField = { key: 'brand', label: 'Brand', type: 'text', placeholder: 'e.g. Nokia, Hima, Colgate' }

// What a service-type business offers when the owner switches "Services" on
// for a type that doesn't normally have it (e.g. a hardware store that also cuts timber).
export const GENERIC_SERVICES = {
  nav: 'Services',
  title: 'Services',
  subtitle: 'Log each service you do — with staff commission and profit worked out for you.',
  singular: 'service',
  plural: 'services',
  workflow: 'walkin', // walkin | booking | job
  staffLabel: 'Done by',
  supplyLabel: 'Supplies / materials used',
  commissionPresets: [0, 10, 20, 30, 40, 50],
  presets: [],
  servicePlaceholder: 'e.g. Delivery, Installation',
  itemDetails: null,
  deposit: false,
  tip: false,
  scheduledLabel: null,
}

// ── The profiles ─────────────────────────────────────────────────────────────

export const BUSINESS_TYPES = {
  // ── Retail shop (duuka) ────────────────────────────────────────────────────
  retail: {
    value: 'retail',
    icon: '🛍',
    label: 'Retail shop',
    blurb: 'General shop — buy, stock and sell goods.',
    vocab: {
      products: 'Products', product: 'Product', stockIn: 'Stock In', sell: 'Sell', sales: 'Sales',
      customers: 'Customers', customer: 'Customer',
      productsSubtitle: 'Everything you sell, with prices and stock levels.',
      dashboardSubtitle: 'A snapshot of your shop right now.',
      namePlaceholder: 'e.g. Cooking Oil 1L, Sugar 1kg',
      customerNotePrompt: 'Anything worth remembering about this customer',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/products', '/stock-in'],
    products: {
      categories: ['General', 'Food & Drink', 'Household', 'Toiletries', 'Stationery', 'Electronics', 'Clothing', 'Other'],
      defaultVariants: false,
      variantLabel: 'Type / size (e.g. 500ml, 1L)',
      fields: [
        brandField,
        { key: 'unit', label: 'Sold per', type: 'select', options: ['Piece', 'Pack', 'Dozen', 'Kg', 'Litre', 'Carton'] },
      ],
      expiry: null,
    },
    sale: { fields: [] },
    expenses: [...COMMON_EXPENSES, 'Restocking transport', 'Packaging'],
    dashboard: ['slowMovers'],
  },

  // ── Supermarket / grocery ──────────────────────────────────────────────────
  supermarket: {
    value: 'supermarket',
    icon: '🛒',
    label: 'Supermarket / Grocery',
    blurb: 'Barcodes, fast checkout, expiry dates and shelf stock.',
    vocab: {
      products: 'Items', product: 'Item', stockIn: 'Stock In', sell: 'Checkout', sales: 'Sales',
      customers: 'Customers', customer: 'Customer',
      productsSubtitle: 'Groceries & household items — scan or type to add.',
      dashboardSubtitle: 'Shelf stock and expiry dates at a glance.',
      namePlaceholder: 'e.g. Cooking Oil 2L, Bread 800g',
      customerNotePrompt: 'Account customer, delivery notes…',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/products', '/stock-in'],
    products: {
      categories: ['Beverages', 'Bread & Bakery', 'Dairy', 'Snacks', 'Cooking Oil', 'Rice & Posho', 'Soap & Detergents', 'Toiletries', 'Vegetables & Fruit', 'Meat & Fish', 'Frozen'],
      defaultVariants: false,
      fields: [
        brandField,
        { key: 'unit', label: 'Sold per', type: 'select', options: ['Piece', 'Pack', 'Kg', 'Litre', 'Dozen', 'Bunch'] },
        { key: 'expiry_date', label: 'Expiry date', type: 'date', hint: 'Earliest expiry of what is on the shelf. You will be warned before it expires.' },
        { key: 'shelf', label: 'Aisle / shelf', type: 'text', placeholder: 'e.g. Aisle 3' },
      ],
      expiry: { warnDays: 30 },
    },
    sale: { fields: [] },
    expenses: [...COMMON_EXPENSES, 'Packaging bags', 'Fridge / freezer power', 'Spoilage & expiry write-off', 'Shelf & equipment'],
    dashboard: ['expiry'],
  },

  // ── Electronics / phones ───────────────────────────────────────────────────
  electronics: {
    value: 'electronics',
    icon: '📱',
    label: 'Electronics / Phones',
    blurb: 'Phones & gadgets with IMEI, warranty — plus repair jobs.',
    vocab: {
      products: 'Products', product: 'Product', stockIn: 'Stock In', sell: 'Sell', sales: 'Sales',
      customers: 'Customers', customer: 'Customer',
      productsSubtitle: 'Phones, accessories & gadgets.',
      dashboardSubtitle: 'Stock, warranty and repair jobs at a glance.',
      namePlaceholder: 'e.g. Samsung A15, Screen Guard',
      customerNotePrompt: 'Phone model, repeat buyer, trade-in…',
    },
    modules: { services: true, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/services', '/products'],
    products: {
      categories: ['Phones', 'Phone Cases', 'Screen Protectors', 'Chargers', 'Earphones', 'Cables', 'Power Banks', 'Tablets', 'Laptops', 'Speakers', 'Accessories'],
      defaultVariants: true,
      variantLabel: 'Type (e.g. Black 128GB, White 256GB)',
      fields: [
        brandField,
        { key: 'model', label: 'Model', type: 'text', placeholder: 'e.g. Galaxy A15' },
        { key: 'condition', label: 'Condition', type: 'select', options: ['New', 'Used', 'Refurbished'] },
        { key: 'imei', label: 'IMEI / Serial no.', type: 'text', hint: 'For a single unit. For many units, note the IMEI on each sale instead.' },
        { key: 'warranty_months', label: 'Warranty (months)', type: 'number' },
      ],
      expiry: null,
    },
    sale: {
      fields: [
        { key: 'serial', label: 'IMEI / serial no. sold (optional)', type: 'text', placeholder: 'So you can trace the warranty later' },
      ],
    },
    services: {
      nav: 'Repairs',
      title: 'Repair jobs',
      subtitle: 'Receive a device, track the repair, and collect payment when it is ready.',
      singular: 'repair',
      plural: 'repairs',
      workflow: 'job',
      staffLabel: 'Technician',
      supplyLabel: 'Parts cost (UGX)',
      commissionPresets: [0, 10, 20, 30, 40],
      presets: ['Screen replacement', 'Battery replacement', 'Charging port repair', 'Software / flashing', 'Water damage repair', 'Unlocking / FRP', 'Speaker / mic repair', 'Laptop repair', 'TV / decoder repair', 'Diagnostics only'],
      servicePlaceholder: 'e.g. Screen replacement',
      itemDetails: { label: 'Device & fault', placeholder: 'e.g. Tecno Spark 10 — cracked screen, IMEI …' },
      deposit: true,
      tip: false,
      scheduledLabel: 'Promised ready by',
    },
    expenses: [...COMMON_EXPENSES, 'Repair tools & parts', 'Warranty replacements', 'Shop display & security'],
    dashboard: ['openJobs', 'slowMovers'],
  },

  // ── Clothing / boutique ────────────────────────────────────────────────────
  clothing: {
    value: 'clothing',
    icon: '👗',
    label: 'Boutique / Clothing',
    blurb: 'Sizes & colours, new arrivals, alterations.',
    vocab: {
      products: 'Collection', product: 'Item', stockIn: 'New Stock', sell: 'Sell', sales: 'Sales',
      customers: 'Clients', customer: 'Client',
      productsSubtitle: 'Your clothes, shoes & accessories — by size and colour.',
      dashboardSubtitle: 'What is selling, what is sitting, and what has run out of sizes.',
      namePlaceholder: 'e.g. Polo Shirt, Skinny Jeans',
      customerNotePrompt: 'Sizes, style preferences, upcoming occasions…',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/products', '/stock-in'],
    products: {
      categories: ['T-Shirts', 'Shirts', 'Trousers & Jeans', 'Dresses', 'Skirts', 'Shoes', 'Jackets', 'Suits', 'Underwear', 'Kids Wear', 'Bags', 'Accessories'],
      defaultVariants: true,
      variantLabel: 'Size / colour (e.g. L Blue, M Red)',
      fields: [
        brandField,
        { key: 'gender', label: 'For', type: 'select', options: ['Women', 'Men', 'Kids', 'Unisex'] },
        { key: 'season', label: 'Collection / season', type: 'text', placeholder: 'e.g. Christmas 2026, New arrival' },
        { key: 'material', label: 'Material', type: 'text', placeholder: 'e.g. Cotton, Leather' },
        { key: 'source', label: 'Source', type: 'select', options: ['New stock', 'Imported', 'Second-hand (mitumba)', 'Locally made'] },
      ],
      expiry: null,
    },
    sale: { fields: [] },
    services: {
      nav: 'Alterations',
      title: 'Alterations & tailoring',
      subtitle: 'Take in a garment, track it, and collect payment when it is ready.',
      singular: 'job',
      plural: 'jobs',
      workflow: 'job',
      staffLabel: 'Tailor',
      supplyLabel: 'Materials cost (UGX)',
      commissionPresets: [0, 10, 20, 30],
      presets: ['Alteration (hem / resize)', 'Tailoring (made-to-measure)', 'Repair / mending', 'Embroidery / printing', 'Pressing / dry cleaning'],
      servicePlaceholder: 'e.g. Hem trousers',
      itemDetails: { label: 'Garment & what to do', placeholder: 'e.g. Blue suit — shorten sleeves 2cm' },
      deposit: true,
      tip: false,
      scheduledLabel: 'Ready by',
    },
    expenses: [...COMMON_EXPENSES, 'Bale / stock transport', 'Display & mannequins', 'Packaging bags', 'Social media ads', 'Tailor / alterations'],
    dashboard: ['slowMovers'],
  },

  // ── Hardware ───────────────────────────────────────────────────────────────
  hardware: {
    value: 'hardware',
    icon: '🔨',
    label: 'Hardware store',
    blurb: 'Cement, iron sheets, pipes — bulk prices for contractors.',
    vocab: {
      products: 'Materials', product: 'Material', stockIn: 'Receive Stock', sell: 'Sell', sales: 'Sales',
      customers: 'Customers', customer: 'Customer',
      productsSubtitle: 'Building materials, tools & fittings — by size and unit.',
      dashboardSubtitle: 'Stock levels and contractor balances at a glance.',
      namePlaceholder: 'e.g. Cement 50kg, Iron Sheet 28G, PVC Pipe 1"',
      customerNotePrompt: 'Contractor / company, site, usual materials…',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/products', '/stock-in'],
    products: {
      categories: ['Cement & Lime', 'Iron Sheets & Roofing', 'Steel & Rebar', 'Timber', 'Paint', 'Plumbing', 'Electrical', 'Nails & Fixings', 'Tools', 'Tiles & Flooring', 'Doors & Windows', 'Safety Gear'],
      defaultVariants: true,
      variantLabel: 'Size / spec (e.g. 12mm, 3m, 4L)',
      fields: [
        brandField,
        { key: 'unit', label: 'Sold per', type: 'select', options: ['Piece', 'Bag', 'Metre', 'Kg', 'Litre', 'Tin', 'Sheet', 'Length', 'Roll', 'Carton', 'Pair', 'Set'] },
        { key: 'spec', label: 'Size / specification', type: 'text', placeholder: 'e.g. 12mm, 2×4 inch, 28 gauge' },
        { key: 'bulk_min_qty', label: 'Contractor price from (qty)', type: 'number', hint: 'Buy this many or more and the contractor price below applies automatically.' },
        { key: 'bulk_price', label: 'Contractor price (UGX each)', type: 'number' },
      ],
      expiry: null,
    },
    sale: {
      fields: [
        { key: 'delivery', label: 'Collection', type: 'chips', options: ['Pick-up', 'Delivery'], default: 'Pick-up' },
        { key: 'deliver_to', label: 'Deliver to (site / area / driver)', type: 'text', showWhen: { delivery: 'Delivery' } },
      ],
    },
    expenses: [...COMMON_EXPENSES, 'Loading & offloading', 'Delivery truck fuel', 'Store / yard rent', 'Damaged & broken stock'],
    dashboard: [],
  },

  // ── Pharmacy ───────────────────────────────────────────────────────────────
  pharmacy: {
    value: 'pharmacy',
    icon: '💊',
    label: 'Pharmacy',
    blurb: 'Batches, expiry dates and prescription-only medicines.',
    vocab: {
      products: 'Medicines', product: 'Medicine', stockIn: 'Receive Stock', sell: 'Dispense', sales: 'Sales',
      customers: 'Patients', customer: 'Patient',
      productsSubtitle: 'Medicines & health products — with batch, expiry and prescription flags.',
      dashboardSubtitle: 'Expiring medicines and low stock — what to act on first.',
      namePlaceholder: 'e.g. Paracetamol 500mg, Amoxicillin 250mg',
      customerNotePrompt: 'Allergies, chronic conditions, regular medicines…',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/products', '/stock-in'],
    products: {
      categories: ['Pain & Fever', 'Antibiotics', 'Antimalarials', 'Cough & Cold', 'Stomach & Digestion', 'Vitamins & Supplements', 'Skin Care', 'Eye & Ear', 'First Aid & Dressings', 'Family Planning', 'Baby Care', 'Medical Devices'],
      defaultVariants: false,
      variantLabel: 'Pack size / strength (e.g. 10 tabs, 100ml)',
      fields: [
        { key: 'generic_name', label: 'Generic name', type: 'text', placeholder: 'e.g. Paracetamol' },
        { key: 'strength', label: 'Strength', type: 'text', placeholder: 'e.g. 500mg' },
        { key: 'dosage_form', label: 'Form', type: 'select', options: ['Tablet', 'Capsule', 'Syrup / Suspension', 'Injection', 'Cream / Ointment', 'Drops', 'Inhaler', 'Sachet', 'Other'] },
        { key: 'pack_unit', label: 'Sold per', type: 'select', options: ['Strip', 'Box', 'Bottle', 'Tube', 'Vial', 'Sachet', 'Piece'] },
        { key: 'batch_no', label: 'Batch no.', type: 'text' },
        { key: 'expiry_date', label: 'Expiry date', type: 'date', hint: 'Earliest expiry of what you hold. You will be warned 90 days before.' },
        { key: 'storage', label: 'Storage', type: 'select', options: ['Room temperature', 'Refrigerated (2–8°C)'] },
        { key: 'requires_prescription', label: 'Prescription-only medicine', type: 'checkbox', hint: 'The till will ask for the patient\u2019s name before selling it.' },
      ],
      expiry: { warnDays: 90 },
    },
    sale: {
      fields: [
        { key: 'patient', label: 'Patient name', type: 'text', requiredWhenRx: true, placeholder: 'Required for prescription-only medicines' },
        { key: 'prescriber', label: 'Prescribed by / clinic', type: 'text', showWhenRx: true },
      ],
    },
    expenses: [...COMMON_EXPENSES, 'Pharmacy licence (NDA)', 'Pharmacist / dispenser salary', 'Expired stock write-off', 'Fridge / cold-chain power', 'Waste disposal'],
    dashboard: ['expiry'],
  },

  // ── Wholesale / distributor ────────────────────────────────────────────────
  wholesale: {
    value: 'wholesale',
    icon: '📦',
    label: 'Wholesale / Distributor',
    blurb: 'Cartons & bulk prices, retailers on credit, deliveries.',
    vocab: {
      products: 'Inventory', product: 'Item', stockIn: 'Receive Stock', sell: 'Sell', sales: 'Sales',
      customers: 'Buyers', customer: 'Buyer',
      productsSubtitle: 'Your wholesale stock — by carton, bale or sack.',
      dashboardSubtitle: 'Stock value, buyers who owe you, and what to reorder.',
      namePlaceholder: 'e.g. Cooking Oil 20L Jerrycan, Sugar 50kg Sack',
      customerNotePrompt: 'Shop name, route / location, credit terms agreed…',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/customers', '/stock-in'],
    products: {
      categories: ['Beverages', 'Cooking Oil', 'Grains & Flour', 'Soap & Cleaning', 'Sugar & Salt', 'Confectionery', 'Toiletries', 'Stationery', 'Canned Goods'],
      defaultVariants: false,
      fields: [
        brandField,
        { key: 'unit', label: 'Sold per', type: 'select', options: ['Carton', 'Bale', 'Sack', 'Dozen', 'Box', 'Crate', 'Piece'] },
        { key: 'pack_size', label: 'Units inside one', type: 'number', hint: 'e.g. 24 bottles in a carton' },
        { key: 'bulk_min_qty', label: 'Bulk price from (qty)', type: 'number', hint: 'Order this many or more and the bulk price applies automatically.' },
        { key: 'bulk_price', label: 'Bulk price (UGX each)', type: 'number' },
        { key: 'expiry_date', label: 'Expiry date', type: 'date' },
      ],
      expiry: { warnDays: 60 },
    },
    sale: {
      fields: [
        { key: 'delivery', label: 'Collection', type: 'chips', options: ['Pick-up', 'Delivery'], default: 'Pick-up' },
        { key: 'deliver_to', label: 'Deliver to (shop / route / driver)', type: 'text', showWhen: { delivery: 'Delivery' } },
      ],
    },
    expenses: [...COMMON_EXPENSES, 'Truck fuel & maintenance', 'Loaders / offloading', 'Warehouse rent', 'Transport & clearing', 'Damaged goods'],
    dashboard: ['expiry'],
  },

  // ── Restaurant / café ──────────────────────────────────────────────────────
  restaurant: {
    value: 'restaurant',
    icon: '🍽',
    label: 'Restaurant / Café',
    blurb: 'Menu, dine-in / takeaway orders, kitchen ingredients.',
    vocab: {
      products: 'Menu', product: 'Menu item', stockIn: 'Buy Ingredients', sell: 'Orders', sales: 'Order History',
      customers: 'Regulars', customer: 'Customer',
      productsSubtitle: 'Your dishes and drinks — plus ingredients you count in stock.',
      dashboardSubtitle: 'Today\u2019s orders and what the kitchen is running low on.',
      namePlaceholder: 'e.g. Chicken & Chips, Passion Juice',
      customerNotePrompt: 'Company account, dietary needs, usual order…',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/products', '/sales'],
    products: {
      categories: ['Breakfast', 'Lunch', 'Dinner', 'Grill & BBQ', 'Fast Food', 'Sides', 'Soups', 'Juices & Smoothies', 'Soft Drinks', 'Hot Drinks', 'Desserts', 'Specials', 'Ingredients'],
      defaultVariants: true,
      variantLabel: 'Size / option (e.g. Small, Large)',
      fields: [
        { key: 'prep_station', label: 'Prepared at', type: 'select', options: ['Kitchen', 'Grill', 'Bar / drinks', 'Bakery / pastry'] },
        { key: 'prep_time_mins', label: 'Prep time (minutes)', type: 'number' },
        {
          key: 'track_stock', label: 'Count this in stock', type: 'checkbox', default: false,
          hint: 'Leave OFF for dishes made to order. Tick for ingredients and bottled drinks you want counted.',
        },
      ],
      expiry: null,
    },
    sale: {
      fields: [
        { key: 'order_type', label: 'Order type', type: 'chips', options: ['Dine-in', 'Takeaway', 'Delivery'], default: 'Dine-in' },
        { key: 'table', label: 'Table / seat', type: 'text', placeholder: 'e.g. Table 4', showWhen: { order_type: 'Dine-in' } },
        { key: 'deliver_to', label: 'Delivery address & phone', type: 'text', showWhen: { order_type: 'Delivery' } },
      ],
    },
    expenses: [...COMMON_EXPENSES, 'Food & ingredients', 'Gas / charcoal', 'Takeaway packaging', 'Cleaning supplies', 'Delivery riders', 'Kitchen equipment', 'Spoilage / wasted food'],
    dashboard: ['orders'],
  },

  // ── Bar / lounge ───────────────────────────────────────────────────────────
  bar: {
    value: 'bar',
    icon: '🍺',
    label: 'Bar / Lounge',
    blurb: 'Bottles & crates, tabs, nightly stock count.',
    vocab: {
      products: 'Drinks', product: 'Drink', stockIn: 'Receive Stock', sell: 'Orders', sales: 'Sales',
      customers: 'Tabs & Regulars', customer: 'Customer',
      productsSubtitle: 'Beers, spirits, soft drinks and bites.',
      dashboardSubtitle: 'Tonight\u2019s takings and what is running out behind the bar.',
      namePlaceholder: 'e.g. Nile Special 500ml, Uganda Waragi 750ml',
      customerNotePrompt: 'Tab limit, regular drink, who vouches for them…',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/stock-in', '/stock-count'],
    products: {
      categories: ['Beer', 'Spirits', 'Wine', 'Soft Drinks', 'Water & Juice', 'Cocktails', 'Energy Drinks', 'Snacks & Bites', 'Cigarettes', 'Hot Drinks'],
      defaultVariants: false,
      variantLabel: 'Serving / size (e.g. Bottle, Tot, 300ml)',
      fields: [
        { key: 'serving', label: 'Sold as', type: 'select', options: ['Bottle', 'Can', 'Crate', 'Tot / shot', 'Glass', 'Jug', 'Keg'] },
        { key: 'volume_ml', label: 'Size (ml)', type: 'number' },
        { key: 'crate_size', label: 'Bottles per crate', type: 'number' },
        { key: 'abv', label: 'Alcohol %', type: 'number' },
      ],
      expiry: null,
    },
    sale: {
      fields: [
        { key: 'table', label: 'Table / seat / tab name', type: 'text', placeholder: 'e.g. Table 7, or Moses’ tab' },
      ],
    },
    expenses: [...COMMON_EXPENSES, 'Liquor & trading licence', 'Ice & mixers', 'Breakages', 'Entertainment / DJ', 'Music licence', 'Cooking gas'],
    dashboard: ['orders'],
  },

  // ── Barbershop ─────────────────────────────────────────────────────────────
  barbershop: {
    value: 'barbershop',
    icon: '💈',
    label: 'Barbershop',
    blurb: 'Walk-in cuts, each barber\u2019s earnings and commission.',
    vocab: {
      products: 'Products & Supplies', product: 'Product', stockIn: 'Restock', sell: 'Sell Products', sales: 'Sales',
      customers: 'Clients', customer: 'Client',
      productsSubtitle: 'Hair products and supplies you sell or use in the shop.',
      dashboardSubtitle: 'Today\u2019s cuts, who is earning, and supplies running low.',
      namePlaceholder: 'e.g. Pomade, Clipper Oil, Razor Blades',
      customerNotePrompt: 'Preferred cut, usual barber, anything to remember…',
    },
    modules: { services: true, stockCount: false },
    navFirst: ['/dashboard', '/services', '/sell', '/customers'],
    products: {
      categories: ['Hair Products', 'Shaving Supplies', 'Clippers & Tools', 'Hair Oil & Pomade', 'Towels & Capes', 'Retail Products'],
      defaultVariants: false,
      fields: [
        brandField,
        { key: 'unit', label: 'Sold per', type: 'select', options: ['Piece', 'Pack', 'Bottle', 'Tin', 'Set'] },
      ],
      expiry: null,
    },
    sale: { fields: [] },
    services: {
      nav: 'Services',
      title: 'Cuts & services',
      subtitle: 'Log each haircut, shave or treatment — with commission and tips worked out for you.',
      singular: 'service',
      plural: 'services',
      workflow: 'walkin',
      staffLabel: 'Barber',
      supplyLabel: 'Supplies used (UGX)',
      commissionPresets: [0, 30, 40, 50, 60],
      presets: ['Haircut', 'Kids cut', 'Shave', 'Beard trim', 'Line-up / shape-up', 'Haircut + beard', 'Hair wash', 'Hair dye / colour', 'Scalp treatment', 'Facial / face scrub', 'Head massage'],
      servicePlaceholder: 'e.g. Haircut, Shave',
      itemDetails: null,
      deposit: false,
      tip: true,
      scheduledLabel: null,
    },
    expenses: [...COMMON_EXPENSES, 'Clipper blades & tools', 'Razors & hygiene supplies', 'Towels & laundry', 'Chair & equipment repair'],
    dashboard: ['serviceStaff'],
  },

  // ── Salon (hair & beauty) ──────────────────────────────────────────────────
  salon: {
    value: 'salon',
    icon: '💇‍♀️',
    label: 'Salon / Beauty',
    blurb: 'Appointments, stylists, hair & nail services, extensions.',
    vocab: {
      products: 'Products & Hair', product: 'Product', stockIn: 'Restock', sell: 'Sell Products', sales: 'Sales',
      customers: 'Clients', customer: 'Client',
      productsSubtitle: 'Hair extensions, wigs, treatments and beauty products.',
      dashboardSubtitle: 'Today\u2019s appointments, stylist earnings and stock.',
      namePlaceholder: 'e.g. Bone Straight 14", Relaxer Kit, Gel Polish',
      customerNotePrompt: 'Hair type, allergies, preferred stylist…',
    },
    modules: { services: true, stockCount: false },
    navFirst: ['/dashboard', '/services', '/customers', '/sell'],
    products: {
      categories: ['Weaves & Extensions', 'Wigs', 'Relaxers & Treatments', 'Shampoo & Conditioner', 'Hair Colour', 'Nail Products', 'Skin & Makeup', 'Tools & Equipment'],
      defaultVariants: true,
      variantLabel: 'Length / colour (e.g. 14", 1B)',
      fields: [
        brandField,
        { key: 'hair_type', label: 'Type / texture', type: 'text', placeholder: 'e.g. Bone straight, Kinky curly' },
        { key: 'expiry_date', label: 'Expiry date', type: 'date' },
      ],
      expiry: { warnDays: 30 },
    },
    sale: { fields: [] },
    services: {
      nav: 'Appointments',
      title: 'Appointments & services',
      subtitle: 'Book clients in, log what was done, and track each stylist\u2019s earnings.',
      singular: 'service',
      plural: 'services',
      workflow: 'booking',
      staffLabel: 'Stylist',
      supplyLabel: 'Products used (UGX)',
      commissionPresets: [0, 30, 40, 50],
      presets: ['Wash & blow-dry', 'Braids', 'Cornrows', 'Twists', 'Weave / extensions fixing', 'Wig installation', 'Relaxer / retouch', 'Hair treatment', 'Haircut / trim', 'Hair colour', 'Manicure', 'Pedicure', 'Gel / acrylic nails', 'Makeup', 'Facial', 'Eyebrows / lashes', 'Bridal package'],
      servicePlaceholder: 'e.g. Box braids',
      itemDetails: null,
      deposit: true,
      tip: true,
      scheduledLabel: 'Appointment date & time',
    },
    expenses: [...COMMON_EXPENSES, 'Hair products & chemicals', 'Towels & laundry', 'Equipment repair', 'Training'],
    dashboard: ['openJobs', 'serviceStaff'],
  },

  // ── Other ──────────────────────────────────────────────────────────────────
  other: {
    value: 'other',
    icon: '🏪',
    label: 'Other business',
    blurb: 'Anything else — turn on Services in Business Info if you need it.',
    vocab: {
      products: 'Products', product: 'Product', stockIn: 'Stock In', sell: 'Sell', sales: 'Sales',
      customers: 'Customers', customer: 'Customer',
      productsSubtitle: 'Everything you sell.',
      dashboardSubtitle: 'A snapshot of your business right now.',
      namePlaceholder: 'e.g. Product name',
      customerNotePrompt: 'Anything worth remembering about this customer',
    },
    modules: { services: false, stockCount: true },
    navFirst: ['/dashboard', '/sell', '/products', '/stock-in'],
    products: {
      categories: ['General', 'Other'],
      defaultVariants: false,
      variantLabel: 'Type / size',
      fields: [brandField, { key: 'unit', label: 'Sold per', type: 'select', options: ['Piece', 'Pack', 'Kg', 'Litre', 'Carton'] }],
      expiry: null,
    },
    sale: { fields: [] },
    expenses: COMMON_EXPENSES,
    dashboard: [],
  },
}

// Order shown in the type picker (most common first).
export const BUSINESS_TYPE_LIST = [
  'retail', 'supermarket', 'electronics', 'clothing', 'hardware', 'pharmacy',
  'wholesale', 'restaurant', 'bar', 'barbershop', 'salon', 'other',
].map((k) => BUSINESS_TYPES[k])

// ── Helpers every page uses ──────────────────────────────────────────────────

export function getProfile(typeOrBusiness) {
  const type = typeof typeOrBusiness === 'string' ? typeOrBusiness : typeOrBusiness?.type
  return BUSINESS_TYPES[type] || BUSINESS_TYPES.retail
}

/** Is the Services module on? The owner can override the type's default in Business Info. */
export function servicesEnabled(business) {
  const override = business?.settings?.services
  if (typeof override === 'boolean') return override
  return !!getProfile(business).modules.services
}

/** Services workflow config for this business (type-specific, or the generic one). */
export function getServicesProfile(business) {
  return getProfile(business).services || GENERIC_SERVICES
}

export function stockCountEnabled(business) {
  return !!getProfile(business).modules.stockCount
}

/** Items made to order (e.g. a restaurant dish) are not counted in stock. */
export function isStockTracked(attributes) {
  return attributes?.track_stock !== false
}

/** Contractor / bulk price: returns the unit price to use for a given quantity. */
export function priceForQuantity(basePrice, attributes, quantity) {
  const minQty = Number(attributes?.bulk_min_qty) || 0
  const bulk = Number(attributes?.bulk_price) || 0
  if (minQty > 0 && bulk > 0 && Number(quantity) >= minQty) return bulk
  return Number(basePrice) || 0
}

// ── Expiry ───────────────────────────────────────────────────────────────────

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

/** 'expired' | 'soon' | 'ok' | null (no date) */
export function expiryStatus(dateStr, warnDays) {
  const d = daysUntil(dateStr)
  if (d === null) return null
  if (d < 0) return 'expired'
  if (d <= warnDays) return 'soon'
  return 'ok'
}

// ── Navigation ───────────────────────────────────────────────────────────────

const BASE_NAV = [
  { to: '/dashboard', icon: '◧', label: () => 'Dashboard' },
  { to: '/products', icon: '▤', label: (p) => p.vocab.products },
  { to: '/stock-in', icon: '↓', label: (p) => p.vocab.stockIn },
  { to: '/sell', icon: '↑', label: (p) => p.vocab.sell },
  { to: '/services', icon: '✂', label: (_p, b) => getServicesProfile(b).nav, needs: servicesEnabled },
  { to: '/sales', icon: '◫', label: (p) => p.vocab.sales },
  { to: '/customers', icon: '⊙', label: (p) => p.vocab.customers },
  { to: '/stock-count', icon: '☑', label: () => 'Stock Count', needs: stockCountEnabled },
  { to: '/lenders', icon: '◐', label: () => 'People I Owe' },
  { to: '/expenses', icon: '−', label: () => 'Expenses' },
  { to: '/spending', icon: '◆', label: () => 'Spending' },
  { to: '/reminders', icon: '⏰', label: () => 'Reminders' },
  { to: '/staff', icon: '◍', label: () => 'Staff' },
  { to: '/reports', icon: '📊', label: () => 'Reports' },
  { to: '/businesses', icon: '🏬', label: () => 'My Businesses' },
  { to: '/business-info', icon: '⚙', label: () => 'Business Info' },
]

/** Sidebar / tab-bar items for a business, in the order that matters for its type. */
export function navItemsFor(business) {
  const profile = getProfile(business)
  const items = BASE_NAV
    .filter((n) => !n.needs || n.needs(business))
    .map((n) => ({ to: n.to, icon: n.icon, label: n.label(profile, business) }))
  const first = profile.navFirst || []
  const rank = (to) => {
    const i = first.indexOf(to)
    return i === -1 ? 999 : i
  }
  return items
    .map((it, idx) => ({ it, idx }))
    .sort((a, b) => rank(a.it.to) - rank(b.it.to) || a.idx - b.idx)
    .map((x) => x.it)
}
