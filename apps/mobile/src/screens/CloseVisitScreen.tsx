import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { NoOrderReason } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "CloseVisit">;

const REASONS: { value: NoOrderReason; label: string }[] = [
  { value: "SHOP_CLOSED", label: "Shop closed" },
  { value: "OWNER_ABSENT", label: "Owner/buyer absent" },
  { value: "SUFFICIENT_STOCK", label: "Sufficient stock already" },
  { value: "CREDIT_ISSUE", label: "Credit / payment issue" },
  { value: "PRICE_ISSUE", label: "Price issue" },
  { value: "OTHER", label: "Other" },
];

export default function CloseVisitScreen({ route, navigation }: Props) {
  const { visitId, retailerName } = route.params;
  const [selectedReason, setSelectedReason] = useState<NoOrderReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedReason) {
      setErrorMessage("Select a reason.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await authedRequest("post", `/visits/${visitId}/close`, {
        outcome: "NO_ORDER",
        noOrderReason: selectedReason,
      });
      navigation.popToTop();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{retailerName}</Text>
      <Text style={styles.subtitle}>
        Ordering isn't available yet in this build — record why no order was taken.
      </Text>

      {REASONS.map((r) => (
        <Pressable
          key={r.value}
          style={[styles.reasonRow, selectedReason === r.value && styles.reasonRowSelected]}
          onPress={() => setSelectedReason(r.value)}
        >
          <View style={[styles.radio, selectedReason === r.value && styles.radioSelected]} />
          <Text style={styles.reasonLabel}>{r.label}</Text>
        </Pressable>
      ))}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Close Visit — No Order</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 20 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  reasonRowSelected: {},
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#999", marginRight: 12 },
  radioSelected: { borderColor: "#1a7f37", backgroundColor: "#1a7f37" },
  reasonLabel: { fontSize: 15 },
  error: { color: "#c0392b", marginTop: 12 },
  button: { backgroundColor: "#1a7f37", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
