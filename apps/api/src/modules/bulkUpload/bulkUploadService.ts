// Shared bulk-upload pipeline (spec §11): one parser/validator framework,
// one row-processor per upload type — this is what keeps four upload types
// from being four forked copies of "parse CSV, validate, report errors."
//
// Every row is parsed and validated FIRST (no partial DB writes on a
// parse-level failure); only then are the passing rows inserted, each in
// its own try/catch so one bad row can't roll back the good ones.
import { parse } from "csv-parse/sync";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { ZodError, ZodType } from "zod";
import {
  bulkRetailerRowSchema,
  bulkProductRowSchema,
  bulkBeatRetailerMappingRowSchema,
  bulkEmployeeRowSchema,
  type BulkUploadType,
  type BulkUploadResult,
} from "@flowmint/shared";
import * as jobRepo from "./bulkUploadRepository";
import * as retailerRepo from "../retailers/retailerRepository";
import * as subcategoryRepo from "../retailerSubcategories/retailerSubcategoryRepository";
import * as productRepo from "../products/productRepository";
import * as catalogRefRepo from "../products/catalogRefRepository";
import * as beatRepo from "../beats/beatRepository";
import * as mappingRepo from "../mappings/mappingRepository";
import * as employeeRepo from "../employees/employeeRepository";

const TEMPLATES: Record<BulkUploadType, string> = {
  RETAILER: "code,name,ownerName,category,subcategoryName,addressLine,city,pincode,phone",
  PRODUCT: "skuCode,name,brandName,categoryName,packSize,uom,mrp,price,gstRate",
  BEAT_RETAILER_MAPPING: "beatCode,retailerCode,sequenceNo",
  EMPLOYEE: "employeeCode,name,phone,role,reportingManagerCode",
};

export function getTemplate(type: BulkUploadType): string {
  return TEMPLATES[type] + "\n";
}

function parseCsv(buffer: Buffer): Record<string, string>[] {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function zodIssuesToMessage(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; ");
}

async function processRetailerRow(companyId: string, createdByEmployeeId: string, raw: Record<string, string>) {
  const row = bulkRetailerRowSchema.parse(raw);
  if (row.code) {
    const existing = await retailerRepo.findByCode(row.code);
    if (existing) throw new Error(`code ${row.code} is already in use`);
  }
  let subcategoryId: string | null = null;
  if (row.subcategoryName) {
    const sub = await subcategoryRepo.findOrCreateByName(row.subcategoryName);
    subcategoryId = sub.id;
  }
  await retailerRepo.createRetailer({
    companyId,
    code: row.code || null,
    name: row.name,
    ownerName: row.ownerName || null,
    category: row.category,
    subcategoryId,
    addressLine: row.addressLine || null,
    city: row.city || null,
    pincode: row.pincode || null,
    phone: row.phone || null,
    source: "BULK",
    createdByEmployeeId,
    phoneVerified: false,
  });
}

async function processProductRow(companyId: string, raw: Record<string, string>) {
  const row = bulkProductRowSchema.parse(raw);
  const existing = await productRepo.findBySkuCode(row.skuCode);
  if (existing) throw new Error(`skuCode ${row.skuCode} is already in use`);
  const brand = await catalogRefRepo.findOrCreateBrandByName(row.brandName);
  const category = await catalogRefRepo.findOrCreateCategoryByName(row.categoryName);
  await productRepo.create({
    companyId,
    brandId: brand.id,
    categoryId: category.id,
    skuCode: row.skuCode,
    name: row.name,
    packSize: row.packSize,
    uom: row.uom || "PCS",
    mrp: row.mrp,
    price: row.price,
    gstRate: row.gstRate,
  });
}

async function processBeatRetailerMappingRow(raw: Record<string, string>) {
  const row = bulkBeatRetailerMappingRowSchema.parse(raw);
  const beat = await beatRepo.findByCode(row.beatCode);
  if (!beat) throw new Error(`beatCode ${row.beatCode} not found`);
  const retailer = await retailerRepo.findByCode(row.retailerCode);
  if (!retailer) throw new Error(`retailerCode ${row.retailerCode} not found`);
  try {
    await mappingRepo.mapBeatRetailerWithCapCheck(beat.id, retailer.id, row.sequenceNo ?? null);
  } catch (err) {
    if (err instanceof mappingRepo.BeatCapacityExceededError) {
      throw new Error(`beat ${row.beatCode} already has ${mappingRepo.BEAT_RETAILER_CAP} active retailers`);
    }
    throw err;
  }
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

async function processEmployeeRow(companyId: string, raw: Record<string, string>) {
  const row = bulkEmployeeRowSchema.parse(raw);
  const existing = await employeeRepo.findByEmployeeCode(row.employeeCode);
  if (existing) throw new Error(`employeeCode ${row.employeeCode} already exists`);

  let reportingManagerId: string | null = null;
  if (row.reportingManagerCode) {
    const manager = await employeeRepo.findByEmployeeCode(row.reportingManagerCode);
    if (!manager) throw new Error(`reportingManagerCode ${row.reportingManagerCode} not found`);
    reportingManagerId = manager.id;
  }

  // Bulk-provisioned employees get a random temp password like any other
  // provisioning path, but — unlike single create — it is not handed back
  // in the upload summary (a multi-row response is the wrong place to carry
  // N plaintext credentials). Use single-employee creation, or
  // forgot-password on first login, to actually get each one a password.
  const passwordHash = await bcrypt.hash(generateTempPassword(), 12);
  await employeeRepo.createEmployee({
    companyId,
    employeeCode: row.employeeCode,
    name: row.name,
    phone: row.phone,
    role: row.role,
    reportingManagerId,
    passwordHash,
  });
}

export async function processUpload(
  type: BulkUploadType,
  companyId: string,
  uploadedByEmployeeId: string,
  filename: string,
  fileBuffer: Buffer
): Promise<BulkUploadResult> {
  const job = await jobRepo.createJob({ uploadType: type, uploadedByEmployeeId, filename });

  let rawRows: Record<string, string>[];
  try {
    rawRows = parseCsv(fileBuffer);
  } catch (err) {
    await jobRepo.addRowError(job.id, 0, `Could not parse file as CSV: ${(err as Error).message}`, {});
    await jobRepo.completeJob(job.id, { totalRows: 0, successRows: 0, failedRows: 1 });
    return { jobId: job.id, totalRows: 0, successRows: 0, failedRows: 1, errors: [{ row: 0, message: "Could not parse file as CSV." }] };
  }

  const errors: { row: number; message: string }[] = [];
  let successRows = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 2; // header is row 1
    const raw = rawRows[i];
    try {
      switch (type) {
        case "RETAILER":
          await processRetailerRow(companyId, uploadedByEmployeeId, raw);
          break;
        case "PRODUCT":
          await processProductRow(companyId, raw);
          break;
        case "BEAT_RETAILER_MAPPING":
          await processBeatRetailerMappingRow(raw);
          break;
        case "EMPLOYEE":
          await processEmployeeRow(companyId, raw);
          break;
      }
      successRows++;
    } catch (err) {
      const message = err instanceof ZodError ? zodIssuesToMessage(err) : (err as Error).message;
      errors.push({ row: rowNumber, message });
      await jobRepo.addRowError(job.id, rowNumber, message, raw);
    }
  }

  await jobRepo.completeJob(job.id, {
    totalRows: rawRows.length,
    successRows,
    failedRows: rawRows.length - successRows,
  });

  return {
    jobId: job.id,
    totalRows: rawRows.length,
    successRows,
    failedRows: rawRows.length - successRows,
    errors,
  };
}
