import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { ProductSummary } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

type Props = NativeStackScreenProps<RootStackParamList, "ProductCatalog">;

interface Category {
  id: string;
  name: string;
}

interface ProductPage {
  products: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 30;

export default function ProductCatalogScreen({ route, navigation }: Props) {
  const { retailerId, retailerName, visitId } = route.params;
  const { lines, totalQty, setQuantity } = useCart();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bumped on every new search/category change so a slow in-flight page 1
  // request can't clobber results from a newer one that finished first.
  const requestId = useRef(0);

  useEffect(() => {
    authedRequest<{ categories: Category[] }>("get", "/products/categories")
      .then((res) => setCategories(res.categories))
      .catch(() => {
        // Filter chips are a convenience, not essential — search still
        // works without categories loaded, so this fails silently.
      });
  }, []);

  const loadPage = useCallback(
    async (pageToLoad: number, isFirstPage: boolean) => {
      const thisRequestId = ++requestId.current;
      if (isFirstPage) {
        setIsLoading(true);
        setErrorMessage(null);
      } else {
        setIsLoadingMore(true);
      }
      try {
        const params = new URLSearchParams({
          search: query,
          page: String(pageToLoad),
          page_size: String(PAGE_SIZE),
        });
        if (selectedCategoryId) params.set("category_id", selectedCategoryId);
        const result = await authedRequest<ProductPage>("get", `/products?${params.toString()}`);
        if (thisRequestId !== requestId.current) return; // superseded by a newer search
        setProducts((prev) => (isFirstPage ? result.products : [...prev, ...result.products]));
        setTotal(result.total);
        setPage(pageToLoad);
      } catch (err) {
        if (thisRequestId !== requestId.current) return;
        setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
      } finally {
        if (thisRequestId !== requestId.current) return;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [query, selectedCategoryId]
  );

  useEffect(() => {
    loadPage(1, true);
  }, [loadPage]);

  const handleEndReached = () => {
    if (isLoading || isLoadingMore || products.length >= total) return;
    loadPage(page + 1, false);
  };

  const quantityFor = (productId: string) =>
    lines.find((l) => l.product.id === productId)?.quantity ?? 0;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by product name or SKU"
        autoCorrect={false}
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
        data={[{ id: null as string | null, name: "All" }, ...categories]}
        keyExtractor={(c) => c.id ?? "all"}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, selectedCategoryId === item.id && styles.chipSelected]}
            onPress={() => setSelectedCategoryId(item.id)}
          >
            <Text style={[styles.chipText, selectedCategoryId === item.id && styles.chipTextSelected]}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        onEndReachedThreshold={0.4}
        onEndReached={handleEndReached}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.empty}>No products found.</Text> : null
        }
        ListFooterComponent={isLoadingMore ? <ActivityIndicator style={styles.loader} /> : null}
        renderItem={({ item }) => {
          const qty = quantityFor(item.id);
          return (
            <View style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.brandName} · {item.packSize} · GST {item.gstRate}%
                </Text>
                <Text style={styles.rowPrice}>₹{item.price}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setQuantity(item, Math.max(0, qty - 1))}
                  disabled={qty === 0}
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </Pressable>
                <Text style={styles.stepperQty}>{qty}</Text>
                <Pressable style={styles.stepperButton} onPress={() => setQuantity(item, qty + 1)}>
                  <Text style={styles.stepperButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      {totalQty > 0 ? (
        <Pressable
          style={styles.cartBar}
          onPress={() => navigation.navigate("Cart", { retailerId, retailerName, visitId })}
        >
          <Text style={styles.cartBarText}>
            View Cart — {totalQty} item{totalQty === 1 ? "" : "s"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  input: {
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  chipRow: { maxHeight: 44, marginBottom: 4 },
  chipRowContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipSelected: { backgroundColor: "#1a56db", borderColor: "#1a56db" },
  chipText: { fontSize: 13, color: "#444" },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  error: { color: "#c0392b", marginHorizontal: 16, marginTop: 8 },
  loader: { marginVertical: 12 },
  empty: { textAlign: "center", color: "#666", marginTop: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowBody: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 15, fontWeight: "600" },
  rowMeta: { fontSize: 12, color: "#888", marginTop: 2 },
  rowPrice: { fontSize: 14, fontWeight: "600", color: "#1a7f37", marginTop: 4 },
  stepper: { flexDirection: "row", alignItems: "center" },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { fontSize: 16, fontWeight: "700", color: "#333" },
  stepperQty: { minWidth: 26, textAlign: "center", fontSize: 15, fontWeight: "600" },
  cartBar: {
    backgroundColor: "#1a7f37",
    paddingVertical: 14,
    alignItems: "center",
  },
  cartBarText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
