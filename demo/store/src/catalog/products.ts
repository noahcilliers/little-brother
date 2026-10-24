import type { Category, Product } from "../contracts/product";

const seed: Product[] = [
  {
    id: "p_dot_notebook",
    slug: "dot-grid-notebook",
    name: "Dot Grid Notebook",
    description: "A5, 160 pages of 100 gsm paper that takes fountain pen ink without bleeding.",
    category: "stationery",
    priceCents: 1800,
    stock: 24,
    emoji: "📓",
  },
  {
    id: "p_brass_pen",
    slug: "brass-pen",
    name: "Brass Rollerball",
    description: "Solid brass body that patinas with use. Takes standard G2 refills.",
    category: "stationery",
    priceCents: 4200,
    stock: 8,
    emoji: "🖋️",
  },
  {
    id: "p_washi",
    slug: "washi-tape-set",
    name: "Washi Tape Set",
    description: "Six rolls in muted tones for journals, labels and gift wrap.",
    category: "stationery",
    priceCents: 1200,
    stock: 40,
    emoji: "🎀",
  },
  {
    id: "p_stoneware_mug",
    slug: "stoneware-mug",
    name: "Stoneware Mug",
    description: "Hand-glazed 350 ml mug. Dishwasher safe, each one a little different.",
    category: "kitchen",
    priceCents: 2600,
    stock: 12,
    emoji: "☕",
  },
  {
    id: "p_pour_over",
    slug: "pour-over-set",
    name: "Pour-Over Set",
    description: "Ceramic dripper, glass carafe and 100 filters.",
    category: "kitchen",
    priceCents: 5400,
    stock: 5,
    emoji: "🫖",
  },
  {
    id: "p_linen_towel",
    slug: "linen-tea-towel",
    name: "Linen Tea Towel",
    description: "Stonewashed linen that gets softer every wash.",
    category: "kitchen",
    priceCents: 1600,
    stock: 30,
    emoji: "🧺",
  },
  {
    id: "p_sencha",
    slug: "first-flush-sencha",
    name: "First Flush Sencha",
    description: "Grassy, bright green tea from Shizuoka. 80 g tin.",
    category: "tea",
    priceCents: 2200,
    stock: 18,
    emoji: "🍵",
  },
  {
    id: "p_earl_grey",
    slug: "smoky-earl-grey",
    name: "Smoky Earl Grey",
    description: "Lapsang base with cold-pressed bergamot. 100 g pouch.",
    category: "tea",
    priceCents: 1400,
    stock: 3,
    emoji: "🫙",
  },
];

/** In-memory table: storage stays trivial so the demo is about coordination, not databases. */
const products = new Map(seed.map((p) => [p.id, { ...p }]));

export function listProducts(category?: Category): Product[] {
  const all = [...products.values()];
  return category ? all.filter((p) => p.category === category) : all;
}

export function getProduct(id: string): Product | undefined {
  return products.get(id);
}

export function getProductBySlug(slug: string): Product | undefined {
  return [...products.values()].find((p) => p.slug === slug);
}

export function decrementStock(id: string, quantity: number): void {
  const product = products.get(id);
  if (!product) throw new Error(`unknown product ${id}`);
  if (product.stock < quantity) throw new Error(`only ${product.stock} of ${product.name} left`);
  product.stock -= quantity;
}
