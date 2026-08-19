// Seed script — realistic fake data for dev/testing.
// 1 company, 1 distributor, 1 salesman, 1 beat (mapped to every day of the
// week since there's only one beat to test against), 8 retailers, 5 brands,
// 5 categories, 20 products spanning multiple GST slabs.
//
// Safe to re-run: truncates and reinserts every table it touches.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../src/db/pool";

const SALESMAN_EMPLOYEE_CODE = "SM001";
const SALESMAN_TEMP_PASSWORD = "Passw0rd!123";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Wipe in FK-safe order so this script is idempotent.
    await client.query(`
      TRUNCATE TABLE
        sales_order_items, sales_orders, beat_visit_log, otp_verifications,
        products, categories, brands,
        beat_retailer_mapping, beat_employee_mapping, beats,
        retailers, employees, distributors, companies
      CASCADE
    `);

    const { rows: [company] } = await client.query(
      `INSERT INTO companies (name, code) VALUES ($1, $2) RETURNING id`,
      ["Flowmint Demo Company", "FLOWMINT-CO"]
    );

    const { rows: [distributor] } = await client.query(
      `INSERT INTO distributors (company_id, name, code) VALUES ($1, $2, $3) RETURNING id`,
      [company.id, "Flowmint Demo Distributor", "FLOWMINT-DIST"]
    );

    const passwordHash = await bcrypt.hash(SALESMAN_TEMP_PASSWORD, 12);
    const { rows: [employee] } = await client.query(
      `INSERT INTO employees (company_id, distributor_id, employee_code, name, phone, role, password_hash)
       VALUES ($1, $2, $3, $4, $5, 'SALESMAN', $6) RETURNING id`,
      [company.id, distributor.id, SALESMAN_EMPLOYEE_CODE, "Ramesh Kumar", "9876543210", passwordHash]
    );

    const { rows: [beat] } = await client.query(
      `INSERT INTO beats (company_id, distributor_id, name, code) VALUES ($1, $2, $3, $4) RETURNING id`,
      [company.id, distributor.id, "Beat A - Market Road", "BEAT-A"]
    );

    // Mapped to every day of week (0=Sun..6=Sat) — seed-only convenience so
    // "today's beat" resolves regardless of which real weekday you test on.
    for (let dow = 0; dow <= 6; dow++) {
      await client.query(
        `INSERT INTO beat_employee_mapping (beat_id, employee_id, day_of_week) VALUES ($1, $2, $3)`,
        [beat.id, employee.id, dow]
      );
    }

    const retailerSeed = [
      ["RTL-001", "Sharma General Store", "Anil Sharma", "12 Market Road", "Kanpur", "208001", "9811100001"],
      ["RTL-002", "Gupta Kirana", "Vinod Gupta", "45 Station Road", "Kanpur", "208002", "9811100002"],
      ["RTL-003", "New Bharat Store", "Ramesh Yadav", "Near Bus Stand", "Kanpur", "208003", "9811100003"],
      ["RTL-004", "Krishna Provision Store", "Suresh Verma", "Gandhi Chowk", "Kanpur", "208001", "9811100004"],
      ["RTL-005", "City General Store", "Rajesh Singh", "Civil Lines", "Kanpur", "208004", "9811100005"],
      ["RTL-006", "Om Sai Kirana", "Manoj Tiwari", "Mall Road", "Kanpur", "208002", "9811100006"],
      ["RTL-007", "Sanjay Store", "Sanjay Mishra", "Rail Bazar", "Kanpur", "208005", "9811100007"],
      ["RTL-008", "Radhe Traders", "Deepak Agarwal", "Nawab Ganj", "Kanpur", "208001", "9811100008"],
    ] as const;

    const retailerIds: string[] = [];
    for (const [code, name, ownerName, addressLine, city, pincode, phone] of retailerSeed) {
      const { rows: [retailer] } = await client.query(
        `INSERT INTO retailers (company_id, distributor_id, code, name, owner_name, address_line, city, pincode, phone, source, phone_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SEED', now()) RETURNING id`,
        [company.id, distributor.id, code, name, ownerName, addressLine, city, pincode, phone]
      );
      retailerIds.push(retailer.id);
    }

    for (let i = 0; i < retailerIds.length; i++) {
      await client.query(
        `INSERT INTO beat_retailer_mapping (beat_id, retailer_id, sequence_no) VALUES ($1, $2, $3)`,
        [beat.id, retailerIds[i], i + 1]
      );
    }

    const brandNames = ["Sunrise", "Everfresh", "GoldLeaf", "Sparkle", "Homely"];
    const brandIds: Record<string, string> = {};
    for (const name of brandNames) {
      const { rows: [brand] } = await client.query(
        `INSERT INTO brands (name) VALUES ($1) RETURNING id`,
        [name]
      );
      brandIds[name] = brand.id;
    }

    const categoryNames = ["Biscuits", "Beverages", "Soaps & Detergents", "Snacks", "Personal Care"];
    const categoryIds: Record<string, string> = {};
    for (const name of categoryNames) {
      const { rows: [category] } = await client.query(
        `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
        [name]
      );
      categoryIds[name] = category.id;
    }

    // 20 products across brands/categories/GST slabs (5/12/18/28%) — real
    // FMCG catalogs mix slabs by category, which is exactly why GST lives
    // on the product record rather than as one global rate.
    const products: Array<{
      sku: string; name: string; brand: string; category: string;
      pack: string; mrp: number; price: number; gst: number;
    }> = [
      { sku: "SUN-BIS-001", name: "Sunrise Glucose Biscuits", brand: "Sunrise", category: "Biscuits", pack: "24 x 100g", mrp: 240, price: 216, gst: 18 },
      { sku: "SUN-BIS-002", name: "Sunrise Cream Biscuits", brand: "Sunrise", category: "Biscuits", pack: "24 x 100g", mrp: 288, price: 260, gst: 18 },
      { sku: "SUN-BIS-003", name: "Sunrise Digestive Biscuits", brand: "Sunrise", category: "Biscuits", pack: "12 x 150g", mrp: 216, price: 195, gst: 18 },
      { sku: "EVF-BEV-001", name: "Everfresh Orange Juice", brand: "Everfresh", category: "Beverages", pack: "24 x 200ml", mrp: 480, price: 432, gst: 12 },
      { sku: "EVF-BEV-002", name: "Everfresh Mango Drink", brand: "Everfresh", category: "Beverages", pack: "24 x 200ml", mrp: 480, price: 432, gst: 12 },
      { sku: "EVF-BEV-003", name: "Everfresh Lemon Soda", brand: "Everfresh", category: "Beverages", pack: "12 x 300ml", mrp: 360, price: 324, gst: 28 },
      { sku: "GLD-SOP-001", name: "GoldLeaf Bath Soap", brand: "GoldLeaf", category: "Soaps & Detergents", pack: "48 x 100g", mrp: 960, price: 864, gst: 18 },
      { sku: "GLD-SOP-002", name: "GoldLeaf Detergent Powder", brand: "GoldLeaf", category: "Soaps & Detergents", pack: "12 x 1kg", mrp: 1440, price: 1296, gst: 18 },
      { sku: "GLD-SOP-003", name: "GoldLeaf Dish Wash Bar", brand: "GoldLeaf", category: "Soaps & Detergents", pack: "36 x 200g", mrp: 720, price: 648, gst: 18 },
      { sku: "SPK-SNK-001", name: "Sparkle Potato Chips", brand: "Sparkle", category: "Snacks", pack: "48 x 30g", mrp: 480, price: 432, gst: 12 },
      { sku: "SPK-SNK-002", name: "Sparkle Namkeen Mix", brand: "Sparkle", category: "Snacks", pack: "24 x 100g", mrp: 480, price: 432, gst: 12 },
      { sku: "SPK-SNK-003", name: "Sparkle Roasted Peanuts", brand: "Sparkle", category: "Snacks", pack: "24 x 100g", mrp: 360, price: 324, gst: 5 },
      { sku: "HML-PCR-001", name: "Homely Toothpaste", brand: "Homely", category: "Personal Care", pack: "72 x 50g", mrp: 1080, price: 972, gst: 18 },
      { sku: "HML-PCR-002", name: "Homely Shampoo Sachet", brand: "Homely", category: "Personal Care", pack: "100 x 5ml", mrp: 500, price: 450, gst: 18 },
      { sku: "HML-PCR-003", name: "Homely Talcum Powder", brand: "Homely", category: "Personal Care", pack: "24 x 100g", mrp: 480, price: 432, gst: 18 },
      { sku: "SUN-BIS-004", name: "Sunrise Marie Biscuits", brand: "Sunrise", category: "Biscuits", pack: "24 x 100g", mrp: 216, price: 195, gst: 18 },
      { sku: "EVF-BEV-004", name: "Everfresh Packaged Water", brand: "Everfresh", category: "Beverages", pack: "24 x 500ml", mrp: 240, price: 216, gst: 5 },
      { sku: "GLD-SOP-004", name: "GoldLeaf Handwash", brand: "GoldLeaf", category: "Soaps & Detergents", pack: "24 x 200ml", mrp: 720, price: 648, gst: 18 },
      { sku: "SPK-SNK-004", name: "Sparkle Chocolate Wafers", brand: "Sparkle", category: "Snacks", pack: "48 x 20g", mrp: 384, price: 346, gst: 18 },
      { sku: "HML-PCR-004", name: "Homely Hair Oil", brand: "Homely", category: "Personal Care", pack: "24 x 100ml", mrp: 720, price: 648, gst: 18 },
    ];

    for (const p of products) {
      await client.query(
        `INSERT INTO products (company_id, brand_id, category_id, sku_code, name, pack_size, uom, mrp, price, gst_rate)
         VALUES ($1, $2, $3, $4, $5, $6, 'PCS', $7, $8, $9)`,
        [company.id, brandIds[p.brand], categoryIds[p.category], p.sku, p.name, p.pack, p.mrp, p.price, p.gst]
      );
    }

    await client.query("COMMIT");

    console.log("Seed complete.");
    console.log(`  Company:    ${company.id} (FLOWMINT-CO)`);
    console.log(`  Distributor: ${distributor.id} (FLOWMINT-DIST)`);
    console.log(`  Beat:       ${beat.id} (BEAT-A), mapped to all 7 days for this salesman`);
    console.log(`  Retailers:  ${retailerIds.length}`);
    console.log(`  Products:   ${products.length}`);
    console.log("");
    console.log(`  Salesman login -> employee_code: ${SALESMAN_EMPLOYEE_CODE}  password: ${SALESMAN_TEMP_PASSWORD}`);
    console.log(`  Salesman phone (for forgot-password OTP testing): 9876543210`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
