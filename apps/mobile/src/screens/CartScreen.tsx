import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Alert } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { OrderResult } from "@flowmint/shared";
import { computeOrderTotals } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { generateUuid } from "../lib/uuid";

type Props = NativeStackScreenProps<RootStackParamList, "Cart">;

function formatRupees(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CartScreen({ route, navigation }: Props) {
  const { retailerId, visitId } = route.params;
  const { lines, setQuantity, clear } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live preview using the same prices the catalog screen already fetched
  // from the server — never re-derived independently, just run through the
  // same shared formula the API uses to price the order for real on submit.
  const totals = useMemo(
    () =>
      computeOrderTotals(
        lines.map((l) => ({
          productId: l.product.id,
          unitPrice: Number(l.product.price),
          quantity: l.quantity,
          gstRate: Number(l.product.gstRate),
        }))
      ),
    [lines]
  );

  const handlePlaceOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const order = await authedRequest<OrderResult>("post", "/orders", {
        clientUuid: generateUuid(),
        retailerId,
        visitId,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      });
      clear();
      Alert.alert(
        "Order placed",
        `${order.orderNumber}\nGrand total: ₹${formatRupees(Number(order.grandTotalAmount))}`,
        [{ text: "OK", onPress: () => navigation.popToTop() }]
      );
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (lines.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Your cart is empty.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={lines}
        keyExtractor={(l) => l.product.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.product.name}</Text>
              <Text style={styles.rowMeta}>
                {item.product.packSize} · ₹{item.product.price} each
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setQuantity(item.product, item.quantity - 1)}
              >
                <Text style={styles.stepperButtonText}>−</Text>
              </Pressable>
              <Text style={styles.stepperQty}>{item.quantity}</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() => setQuantity(item.product, item.quantity + 1)}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₹{formatRupees(totals.subtotalAmount)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Discount ({totals.discountPct}%)</Text>
          <Text style={styles.summaryValue}>−₹{formatRupees(totals.discountAmount)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>GST</Text>
          <Text style={styles.summaryValue}>₹{formatRupees(totals.gstAmount)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowTotal]}>
          <Text style={styles.summaryLabelTotal}>Grand Total</Text>
          <Text style={styles.summaryValueTotal}>₹{formatRupees(totals.grandTotalAmount)}</Text>
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable style={styles.button} onPress={handlePlaceOrder} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Place Order</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { color: "#666", fontSize: 15 },
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
  summary: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    padding: 16,
    backgroundColor: "#fafafa",
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: "#555" },
  summaryValue: { fontSize: 13, color: "#333" },
  summaryRowTotal: { borderTopWidth: 1, borderTopColor: "#ddd", marginTop: 6, paddingTop: 10 },
  summaryLabelTotal: { fontSize: 15, fontWeight: "700" },
  summaryValueTotal: { fontSize: 15, fontWeight: "700", color: "#1a7f37" },
  error: { color: "#c0392b", marginTop: 10 },
  button: {
    backgroundColor: "#1a7f37",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
