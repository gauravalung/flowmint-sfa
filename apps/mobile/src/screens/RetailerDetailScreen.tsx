import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { RetailerSummary } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";
import { generateUuid } from "../lib/uuid";

type Props = NativeStackScreenProps<RootStackParamList, "RetailerDetail">;

export default function RetailerDetailScreen({ route, navigation }: Props) {
  const { retailerId, beatId, visitId, visitStatus } = route.params;
  const [retailer, setRetailer] = useState<RetailerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
          const result = await authedRequest<RetailerSummary>("get", `/retailers/${retailerId}`);
          if (!cancelled) setRetailer(result);
        } catch (err) {
          if (!cancelled) {
            setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [retailerId])
  );

  const handleCall = () => {
    if (retailer?.phone) Linking.openURL(`tel:${retailer.phone}`);
  };

  const handleStartVisit = async () => {
    setIsStarting(true);
    setErrorMessage(null);
    try {
      const visit = await authedRequest<{ id: string }>("post", "/visits", {
        clientUuid: generateUuid(),
        retailerId,
        beatId: beatId ?? undefined,
        isOffBeat: !beatId,
      });
      navigation.replace("CloseVisit", { visitId: visit.id, retailerName: retailer?.name ?? "" });
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!retailer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{errorMessage ?? "Retailer not found."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{retailer.name}</Text>
      {retailer.ownerName ? <Text style={styles.field}>Owner: {retailer.ownerName}</Text> : null}
      {retailer.addressLine ? <Text style={styles.field}>{retailer.addressLine}</Text> : null}
      {retailer.city || retailer.pincode ? (
        <Text style={styles.field}>
          {retailer.city ?? ""} {retailer.pincode ?? ""}
        </Text>
      ) : null}
      {retailer.phone ? (
        <Pressable onPress={handleCall}>
          <Text style={styles.phoneLink}>📞 {retailer.phone}</Text>
        </Pressable>
      ) : null}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.spacer} />

      {visitStatus === "IN_PROGRESS" && visitId ? (
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate("CloseVisit", { visitId, retailerName: retailer.name })}
        >
          <Text style={styles.buttonText}>Close Visit</Text>
        </Pressable>
      ) : visitStatus === "ORDER_BOOKED" || visitStatus === "NO_ORDER" ? (
        <View style={styles.doneBanner}>
          <Text style={styles.doneBannerText}>Already visited today.</Text>
        </View>
      ) : (
        <Pressable style={styles.button} onPress={handleStartVisit} disabled={isStarting}>
          {isStarting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start Visit</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  field: { fontSize: 14, color: "#444", marginBottom: 4 },
  phoneLink: { fontSize: 15, color: "#1a56db", marginTop: 10 },
  error: { color: "#c0392b", marginTop: 12 },
  spacer: { flex: 1 },
  button: { backgroundColor: "#1a7f37", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  doneBanner: { backgroundColor: "#f1f1f1", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  doneBannerText: { color: "#555", fontSize: 14, fontWeight: "600" },
});
