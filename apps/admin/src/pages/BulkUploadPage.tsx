import { useRef, useState } from "react";
import type { BulkUploadResult, BulkUploadType } from "@flowmint/shared";
import { authedBlob, authedUpload } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

const TYPES: { key: BulkUploadType; label: string }[] = [
  { key: "RETAILER", label: "Retailer master" },
  { key: "PRODUCT", label: "Product / SKU master" },
  { key: "BEAT_RETAILER_MAPPING", label: "Beat–Retailer mapping" },
  { key: "EMPLOYEE", label: "Salesman / Employee master" },
];

export default function BulkUploadPage() {
  const [activeType, setActiveType] = useState<BulkUploadType>("RETAILER");

  return (
    <div>
      <div className="page-header">
        <h1>Bulk Upload</h1>
      </div>
      <p className="muted">
        Download the template for the exact expected columns, fill it in, then upload. Every row is validated
        before anything is imported — no partial or silently-bad rows (spec §11).
      </p>

      <div className="tabs">
        {TYPES.map((t) => (
          <button key={t.key} className={t.key === activeType ? "active" : ""} onClick={() => setActiveType(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <UploadPanel key={activeType} type={activeType} />
    </div>
  );
}

function UploadPanel({ type }: { type: BulkUploadType }) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await authedBlob(`/admin/bulk-upload/${type}/template`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type.toLowerCase()}_template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not download the template.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMessage(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await authedUpload<BulkUploadResult>(`/admin/bulk-upload/${type}`, formData);
      setResult(uploadResult);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" onClick={handleDownloadTemplate}>
          Download template
        </button>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="btn btn-primary" onClick={handleUpload} disabled={!file || isUploading}>
          {isUploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {result ? (
        <div className="card">
          <div style={{ display: "flex", gap: 24, marginBottom: result.errors.length ? 16 : 0 }}>
            <div>
              Total rows: <strong>{result.totalRows}</strong>
            </div>
            <div style={{ color: "var(--success)" }}>
              Succeeded: <strong>{result.successRows}</strong>
            </div>
            <div style={{ color: result.failedRows > 0 ? "var(--danger)" : undefined }}>
              Failed: <strong>{result.failedRows}</strong>
            </div>
          </div>
          {result.errors.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Row</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((e, i) => (
                  <tr key={i}>
                    <td>{e.row}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
