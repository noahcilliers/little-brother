const PRODUCTS = [
  ["Classic Tee", "Soft cotton crew-neck t-shirt.", 1999, "apparel", 50],
  ["Hoodie", "Midweight fleece pullover hoodie.", 4999, "apparel", 30],
  ["Canvas Sneakers", "Low-top sneakers for everyday wear.", 6499, "footwear", 20],
  ["Trail Runners", "Grippy running shoes for rough terrain.", 11999, "footwear", 12],
  ["Ceramic Mug", "12 oz stoneware mug, dishwasher safe.", 1499, "home", 80],
  ["Desk Lamp", "Dimmable LED lamp with USB charging port.", 3999, "home", 25],
  ["Wireless Earbuds", "Bluetooth earbuds with 24h battery case.", 7999, "electronics", 40],
  ["Phone Stand", "Adjustable aluminum phone stand.", 2499, "electronics", 60],
];

export function seedProducts(db) {
  const insert = db.prepare(
    "INSERT INTO products (name, description, price_cents, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)",
  );
  PRODUCTS.forEach(([name, description, price, category, stock], i) => {
    insert.run(name, description, price, `https://picsum.photos/seed/product${i + 1}/400/400`, category, stock);
  });
}
