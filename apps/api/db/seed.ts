// Seed script — realistic fake data for dev/testing, Phase 1 schema.
// 1 company; 1 Super Distributor + 1 Direct Distributor + 1 Sub Distributor
// (under the Super); an ADMIN, an RSM, an ASM, and a Sales Officer with a
// real reporting chain; 1 beat mapped to the Direct Distributor and to the
// Sales Officer (with a day_of_week fallback so "today's beat" resolves
// regardless of which real weekday you test on); 8 retailers with
// category/subcategory, mapped to the beat and to the Direct Distributor;
// 5 brands, 5 categories, 20 products spanning multiple GST slabs, stocked
// into the Direct Distributor's inventory.
//
// Safe to re-run: truncates and reinserts every table it touches.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "../src/db/pool";

const ADMIN_EMPLOYEE_CODE = "ADM001";
const RSM_EMPLOYEE_CODE = "RSM001";
const ASM_EMPLOYEE_CODE = "ASM001";
const SALES_OFFICER_EMPLOYEE_CODE = "SO001";
const SEED_PASSWORD = "Passw0rd!123";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Wipe in FK-safe order so this script is idempotent.
    await client.query(`
      TRUNCATE TABLE
        sales_order_items, sales_orders, beat_visit_log, work_day_sessions, pjp_entries,
        login_face_verifications, otp_verifications, bulk_upload_row_errors, bulk_upload_jobs,
        status_change_log,
        distribution_partner_product_inventory, products, categories, brands,
        employee_retailer_mapping, employee_beat_mapping, employee_distribution_partner_mapping,
        retailer_distribution_partner_mapping, beat_retailer_mapping, distribution_partner_beat_mapping,
        beats, retailers,
        employees, distribution_partners, companies,
        system_settings
      CASCADE
    `);
    // retailer_subcategories is deliberately NOT truncated — it's
    // admin-editable reference data (like brands/categories), seeded once
    // by the migration (spec §5); re-seeding it here would either duplicate
    // rows or require re-deriving ids the retailer rows below depend on.
    // Sequences aren't reset on purpose — "never reused" is the point (spec §3).

    const { rows: [company] } = await client.query(
      `INSERT INTO companies (name, code) VALUES ($1, $2) RETURNING id`,
      ["Flowmint Demo Company", "FLOWMINT-CO"]
    );

    await client.query(
      `INSERT INTO system_settings (key, value) VALUES
         ('otp_mandatory_for_outlet_creation', 'true'),
         ('dashboard_order_value_basis', '"MRP"'),
         ('gps_verification_radius_meters', '200')`
    );

    // --- Distribution hierarchy -------------------------------------------------
    const { rows: [superDistributor] } = await client.query(
      `INSERT INTO distribution_partners (company_id, partner_type, code, name, contact_phone)
       VALUES ($1, 'SUPER_DISTRIBUTOR', $2, $3, $4) RETURNING id`,
      [company.id, "SUPER-01", "Northern Super Distributors", "9811100000"]
    );
    const { rows: [directDistributor] } = await client.query(
      `INSERT INTO distribution_partners (company_id, partner_type, code, name, contact_phone)
       VALUES ($1, 'DIRECT_DISTRIBUTOR', $2, $3, $4) RETURNING id`,
      [company.id, "DIST-01", "Flowmint Demo Distributor", "9811100001"]
    );
    const { rows: [subDistributor] } = await client.query(
      `INSERT INTO distribution_partners (company_id, partner_type, code, parent_partner_id, name, contact_phone)
       VALUES ($1, 'SUB_DISTRIBUTOR', 'SUB' || nextval('sub_distributor_code_seq'), $2, $3, $4) RETURNING id`,
      [company.id, superDistributor.id, "Kanpur Sub Distributor", "9811100002"]
    );

    // --- Employees / reporting hierarchy ----------------------------------------
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

    const { rows: [admin] } = await client.query(
      `INSERT INTO employees (company_id, employee_code, name, phone, role, password_hash)
       VALUES ($1, $2, 'Priya Admin', '9876500000', 'ADMIN', $3) RETURNING id`,
      [company.id, ADMIN_EMPLOYEE_CODE, passwordHash]
    );
    const { rows: [rsm] } = await client.query(
      `INSERT INTO employees (company_id, employee_code, name, phone, role, reporting_manager_id, password_hash)
       VALUES ($1, $2, 'Rakesh RSM', '9876500001', 'RSM', $3, $4) RETURNING id`,
      [company.id, RSM_EMPLOYEE_CODE, admin.id, passwordHash]
    );
    const { rows: [asm] } = await client.query(
      `INSERT INTO employees (company_id, employee_code, name, phone, role, reporting_manager_id, password_hash)
       VALUES ($1, $2, 'Anita ASM', '9876500002', 'ASM', $3, $4) RETURNING id`,
      [company.id, ASM_EMPLOYEE_CODE, rsm.id, passwordHash]
    );
    const { rows: [salesOfficer] } = await client.query(
      `INSERT INTO employees (company_id, employee_code, name, phone, role, reporting_manager_id, password_hash)
       VALUES ($1, $2, 'Ramesh Kumar', '9876543210', 'SALES_OFFICER', $3, $4) RETURNING id`,
      [company.id, SALES_OFFICER_EMPLOYEE_CODE, asm.id, passwordHash]
    );

    // --- Beat, mapped to the Direct Distributor and to the Sales Officer -------
    const { rows: [beat] } = await client.query(
      `INSERT INTO beats (company_id, name, code) VALUES ($1, $2, $3) RETURNING id`,
      [company.id, "Beat A - Market Road", "BEAT-A"]
    );
    await client.query(
      `INSERT INTO distribution_partner_beat_mapping (distribution_partner_id, beat_id) VALUES ($1, $2)`,
      [directDistributor.id, beat.id]
    );
    await client.query(
      `INSERT INTO employee_distribution_partner_mapping (employee_id, distribution_partner_id) VALUES ($1, $2)`,
      [salesOfficer.id, directDistributor.id]
    );
    // day_of_week is the MVP-era "today's beat" fallback (see
    // beatRepository.ts) — employee_beat_mapping is UNIQUE(employee_id,
    // beat_id), so with only one beat in this seed the mapping can carry
    // just one day_of_week value. Pin it to today's real weekday so "today's
    // beat" resolves regardless of which day you run/test this on.
    const today = new Date();
    await client.query(
      `INSERT INTO employee_beat_mapping (employee_id, beat_id, day_of_week) VALUES ($1, $2, $3)`,
      [salesOfficer.id, beat.id, today.getDay()]
    );

    // --- Retailer subcategories (placeholder list already seeded by the
    // migration — General Store / Grocery Store / Departmental Store) ----------
    const { rows: subcategories } = await client.query(`SELECT id, name FROM retailer_subcategories`);
    const generalStoreId = subcategories.find((s) => s.name === "General Store")!.id;
    const groceryStoreId = subcategories.find((s) => s.name === "Grocery Store")!.id;

    // --- Retailers, mapped to the beat and to the Direct Distributor ----------
    const retailerSeed = [
      ["Sharma General Store", "Anil Sharma", generalStoreId, "12 Market Road", "Kanpur", "208001", "9811100001"],
      ["Gupta Kirana", "Vinod Gupta", groceryStoreId, "45 Station Road", "Kanpur", "208002", "9811100002"],
      ["New Bharat Store", "Ramesh Yadav", generalStoreId, "Near Bus Stand", "Kanpur", "208003", "9811100003"],
      ["Krishna Provision Store", "Suresh Verma", groceryStoreId, "Gandhi Chowk", "Kanpur", "208001", "9811100004"],
      ["City General Store", "Rajesh Singh", generalStoreId, "Civil Lines", "Kanpur", "208004", "9811100005"],
      ["Om Sai Kirana", "Manoj Tiwari", groceryStoreId, "Mall Road", "Kanpur", "208002", "9811100006"],
      ["Sanjay Store", "Sanjay Mishra", generalStoreId, "Rail Bazar", "Kanpur", "208005", "9811100007"],
      ["Radhe Traders", "Deepak Agarwal", groceryStoreId, "Nawab Ganj", "Kanpur", "208001", "9811100008"],
    ] as const;

    let sequenceNo = 1;
    for (const [name, ownerName, subcategoryId, addressLine, city, pincode, phone] of retailerSeed) {
      const { rows: [retailer] } = await client.query(
        `INSERT INTO retailers (company_id, code, name, owner_name, category, subcategory_id, address_line, city, pincode, phone, source, phone_verified_at)
         VALUES ($1, 'RET' || nextval('retailer_code_seq'), $2, $3, 'RETAIL', $4, $5, $6, $7, $8, 'SEED', now())
         RETURNING id`,
        [company.id, name, ownerName, subcategoryId, addressLine, city, pincode, phone]
      );
      await client.query(
        `INSERT INTO beat_retailer_mapping (beat_id, retailer_id, sequence_no) VALUES ($1, $2, $3)`,
        [beat.id, retailer.id, sequenceNo++]
      );
      await client.query(
        `INSERT INTO retailer_distribution_partner_mapping (retailer_id, distribution_partner_id) VALUES ($1, $2)`,
        [retailer.id, directDistributor.id]
      );
    }

    // --- Catalog: brands, categories, products, stocked into the Direct
    // Distributor's inventory -----------------------------------------------
    const brandNames = ["VLCC Essentials", "GlowCare", "PureSkin", "HerbalTouch", "DailyFresh"];
    const brandIds: string[] = [];
    for (const name of brandNames) {
      const { rows: [brand] } = await client.query(`INSERT INTO brands (name) VALUES ($1) RETURNING id`, [name]);
      brandIds.push(brand.id);
    }

    const categoryNames = ["Skin Care", "Hair Care", "Body Care", "Oral Care", "Personal Hygiene"];
    const categoryIds: string[] = [];
    for (const name of categoryNames) {
      const { rows: [category] } = await client.query(`INSERT INTO categories (name) VALUES ($1) RETURNING id`, [name]);
      categoryIds.push(category.id);
    }

    const gstRates = [5, 12, 18, 28];
    for (let i = 1; i <= 20; i++) {
      const brandId = brandIds[i % brandIds.length];
      const categoryId = categoryIds[i % categoryIds.length];
      const gstRate = gstRates[i % gstRates.length];
      const mrp = 50 + i * 15;
      const price = Math.round(mrp * 0.85 * 100) / 100;
      const { rows: [product] } = await client.query(
        `INSERT INTO products (company_id, brand_id, category_id, sku_code, name, pack_size, uom, mrp, price, gst_rate)
         VALUES ($1, $2, $3, $4, $5, $6, 'PCS', $7, $8, $9) RETURNING id`,
        [company.id, brandId, categoryId, `SKU-${String(i).padStart(4, "0")}`, `Product ${i}`, `${50 + i * 5}g`, mrp, price, gstRate]
      );
      await client.query(
        `INSERT INTO distribution_partner_product_inventory (distribution_partner_id, product_id, available_qty, is_focus_product)
         VALUES ($1, $2, $3, $4)`,
        [directDistributor.id, product.id, 100 + i * 10, i % 5 === 0]
      );
    }

    await client.query("COMMIT");

    console.log("Seed complete.");
    console.log("");
    console.log("Login credentials (all share one password for dev convenience):");
    console.log(`  ADMIN:          ${ADMIN_EMPLOYEE_CODE} / ${SEED_PASSWORD}`);
    console.log(`  RSM:            ${RSM_EMPLOYEE_CODE} / ${SEED_PASSWORD}`);
    console.log(`  ASM:            ${ASM_EMPLOYEE_CODE} / ${SEED_PASSWORD}`);
    console.log(`  SALES_OFFICER:  ${SALES_OFFICER_EMPLOYEE_CODE} / ${SEED_PASSWORD}`);
    console.log("");
    console.log(`Super Distributor:  ${superDistributor.id} (SUPER-01)`);
    console.log(`Direct Distributor: ${directDistributor.id} (DIST-01)`);
    console.log(`Sub Distributor:    ${subDistributor.id}`);
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
