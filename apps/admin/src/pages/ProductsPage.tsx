import { useEffect, useState } from "react";
import type { DistributionPartnerSummary, ProductSummary } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../auth/AuthContext";

interface RefOption {
  id: string;
  name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [brands, setBrands] = useState<RefOption[]>([]);
  const [categories, setCategories] = useState<RefOption[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (search.trim()) params.set("search", search.trim());
      const result = await authedRequest<{ products: ProductSummary[]; total: number }>(
        "get",
        `/admin/products?${params.toString()}`
      );
      setProducts(result.products);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load products.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    authedRequest<{ brands: RefOption[] }>("get", "/admin/products/brands").then((r) => setBrands(r.brands)).catch(() => {});
    authedRequest<{ categories: RefOption[] }>("get", "/admin/products/categories").then((r) => setCategories(r.categories)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New Product"}
        </button>
      </div>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      {showForm ? (
        <CreateProductForm
          brands={brands}
          categories={categories}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
          onError={setErrorMessage}
        />
      ) : null}

      <form className="toolbar" onSubmit={handleSearchSubmit}>
        <input placeholder="Search name or SKU…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn btn-sm">
          Search
        </button>
      </form>

      <div className="card" style={{ padding: 0 }}>
        {isLoading ? (
          <p className="muted" style={{ padding: 20 }}>
            Loading…
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Pack</th>
                <th>MRP</th>
                <th>Price</th>
                <th>GST %</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.skuCode}</td>
                  <td>{p.name}</td>
                  <td>{p.brandName}</td>
                  <td>{p.categoryName}</td>
                  <td>
                    {p.packSize} {p.uom}
                  </td>
                  <td>₹{p.mrp}</td>
                  <td>₹{p.price}</td>
                  <td>{p.gstRate}%</td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: 16 }}>
                    No products found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      <DistributorInventorySection products={products} />
    </div>
  );
}

function CreateProductForm({
  brands,
  categories,
  onCreated,
  onError,
}: {
  brands: RefOption[];
  categories: RefOption[];
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [skuCode, setSkuCode] = useState("");
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [packSize, setPackSize] = useState("");
  const [uom, setUom] = useState("PCS");
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await authedRequest("post", "/admin/products", {
        skuCode: skuCode.trim(),
        name: name.trim(),
        brandName: brandName.trim(),
        categoryName: categoryName.trim(),
        packSize: packSize.trim(),
        uom: uom.trim() || undefined,
        mrp: Number(mrp),
        price: Number(price),
        gstRate: Number(gstRate),
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiRequestError ? err.message : "Could not create product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <p className="muted" style={{ marginTop: 0 }}>
        Brand/category are free text — an existing name reuses that brand/category, a new one is created
        automatically (same behavior as bulk product upload).
      </p>
      <datalist id="brand-options">
        {brands.map((b) => (
          <option key={b.id} value={b.name} />
        ))}
      </datalist>
      <datalist id="category-options">
        {categories.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <div className="form-grid">
        <div className="form-field">
          <label>SKU code *</label>
          <input value={skuCode} onChange={(e) => setSkuCode(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>Brand *</label>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} list="brand-options" required />
        </div>
        <div className="form-field">
          <label>Category *</label>
          <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} list="category-options" required />
        </div>
        <div className="form-field">
          <label>Pack size *</label>
          <input value={packSize} onChange={(e) => setPackSize(e.target.value)} required placeholder="e.g. 100g" />
        </div>
        <div className="form-field">
          <label>UOM</label>
          <input value={uom} onChange={(e) => setUom(e.target.value)} />
        </div>
        <div className="form-field">
          <label>MRP *</label>
          <input type="number" step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>Price *</label>
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div className="form-field">
          <label>GST rate % *</label>
          <input type="number" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} required />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  );
}

function DistributorInventorySection({ products }: { products: ProductSummary[] }) {
  const [partners, setPartners] = useState<DistributionPartnerSummary[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [inventory, setInventory] = useState<ProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { qty: string; focus: boolean }>>({});

  useEffect(() => {
    authedRequest<{ partners: DistributionPartnerSummary[] }>("get", "/admin/distribution-partners?isActive=true")
      .then((r) => setPartners(r.partners))
      .catch(() => {});
  }, []);

  const loadInventory = async (id: string) => {
    if (!id) {
      setInventory([]);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await authedRequest<{ products: ProductSummary[]; total: number }>(
        "get",
        `/distributors/${id}/products?pageSize=200`
      );
      setInventory(result.products);
      const nextDrafts: Record<string, { qty: string; focus: boolean }> = {};
      for (const p of result.products) {
        nextDrafts[p.id] = { qty: String(p.availableQty ?? 0), focus: p.isFocusProduct ?? false };
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not load inventory.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPartner = (id: string) => {
    setPartnerId(id);
    loadInventory(id);
  };

  const saveInventory = async (productId: string) => {
    const draft = drafts[productId];
    if (!draft) return;
    setSavingId(productId);
    try {
      await authedRequest("put", `/admin/products/distribution-partners/${partnerId}/inventory`, {
        productId,
        availableQty: Number(draft.qty) || 0,
        isFocusProduct: draft.focus,
      });
      await loadInventory(partnerId);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not save inventory.");
    } finally {
      setSavingId(null);
    }
  };

  const inventoryProductIds = new Set(inventory.map((p) => p.id));
  const notYetStocked = products.filter((p) => !inventoryProductIds.has(p.id));

  return (
    <div>
      <div className="page-header" style={{ marginTop: 28 }}>
        <h1 style={{ fontSize: 16 }}>Distributor Inventory</h1>
      </div>
      <p className="muted">
        Per-distributor stock/focus overlay on the shared catalog (spec §8.6) — this is what "Place New Order"
        reads on the mobile app.
      </p>

      {errorMessage ? <div className="alert alert-error">{errorMessage}</div> : null}

      <div className="toolbar">
        <select value={partnerId} onChange={(e) => handleSelectPartner(e.target.value)}>
          <option value="">Select a distribution partner…</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
      </div>

      {partnerId ? (
        isLoading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Available qty</th>
                  <th>Focus product</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...inventory, ...notYetStocked.map((p) => ({ ...p, availableQty: 0, isFocusProduct: false }))].map(
                  (p) => (
                    <tr key={p.id}>
                      <td>
                        {p.name} ({p.skuCode})
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          style={{ width: 90 }}
                          value={drafts[p.id]?.qty ?? "0"}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [p.id]: { qty: e.target.value, focus: d[p.id]?.focus ?? false } }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={drafts[p.id]?.focus ?? false}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [p.id]: { qty: d[p.id]?.qty ?? "0", focus: e.target.checked } }))
                          }
                        />
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => saveInventory(p.id)} disabled={savingId === p.id}>
                          {savingId === p.id ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}
