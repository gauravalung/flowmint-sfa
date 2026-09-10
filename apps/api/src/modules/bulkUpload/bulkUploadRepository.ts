import { pool } from "../../db/pool";
import type { BulkUploadType } from "@flowmint/shared";

export interface BulkUploadJobRow {
  id: string;
  upload_type: BulkUploadType;
  uploaded_by_employee_id: string;
  filename: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  created_at: Date;
  completed_at: Date | null;
}

export async function createJob(params: {
  uploadType: BulkUploadType;
  uploadedByEmployeeId: string;
  filename: string;
}): Promise<BulkUploadJobRow> {
  const { rows } = await pool.query<BulkUploadJobRow>(
    `INSERT INTO bulk_upload_jobs (upload_type, uploaded_by_employee_id, filename)
     VALUES ($1, $2, $3) RETURNING *`,
    [params.uploadType, params.uploadedByEmployeeId, params.filename]
  );
  return rows[0];
}

export async function completeJob(
  id: string,
  totals: { totalRows: number; successRows: number; failedRows: number }
): Promise<void> {
  await pool.query(
    `UPDATE bulk_upload_jobs
     SET status = 'COMPLETED', total_rows = $2, success_rows = $3, failed_rows = $4, completed_at = now()
     WHERE id = $1`,
    [id, totals.totalRows, totals.successRows, totals.failedRows]
  );
}

export async function addRowError(jobId: string, rowNumber: number, message: string, rawRow: unknown): Promise<void> {
  await pool.query(
    `INSERT INTO bulk_upload_row_errors (job_id, row_number, error_message, raw_row_json) VALUES ($1, $2, $3, $4)`,
    [jobId, rowNumber, message, JSON.stringify(rawRow)]
  );
}
