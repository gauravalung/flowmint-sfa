import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { TodayBeatResponse, BeatRetailerEntry } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError, useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const STATUS_LABEL: Record<BeatRetailerEntry["visitStatus"], string> = {
  PENDING: "Not visited",
  IN_PROGRESS: "In progress",
  ORDER_BOOKED: "Order booked",
  NO_ORDER: "No order",
};

const STATUS_COLOR: Record<BeatRetailerEntry["visitStatus"], string> = {
  PENDING: "#666",
  IN_PROGRESS: "#b7791f",
  ORDER_BOOKED: "#1a7f37",
  NO_ORDER: "#999",
};

export default function TodayBeatScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [beat, setBeat] = useState<TodayBeatResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await authedRequest<TodayBeatResponse>("get", "/me/beat/today");
      setBeat(result);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Re-fetch every time this screen regains focus — coming back from closing
  // a visit or adding an outlet should show the updated list without a
  // manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      load(beat === null);
    }, [load, beat])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    load(false);
  };

  const goToRetailer = (r: BeatRetailerEntry) => {
    navigation.navigate("RetailerDetail", {
      retailerId: r.id,
      retailerName: r.name,
      beatId: beat?.beatId ?? null,
      visitId: r.visitId,
      visitStatus: r.visitStatus,
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.beatName}>{beat?.beatName ?? "No beat scheduled today"}</Text>
        <Pressable onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.actionsRow}>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("OffBeatSearch")}>
          <Text style={styles.secondaryButtonText}>Off-beat retailer</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("AddOutlet")}>
          <Text style={styles.secondaryButtonText}>+ New outlet</Text>
        </Pressable>
      </View>

      <FlatList
        data={beat?.retailers ?? []}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {beat?.beatId ? "No retailers mapped to today's beat." : "You have no beat assigned for today."}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => goToRetailer(item)}>
            <View style={styles.rowSeq}>
              <Text style={styles.rowSeqText}>{item.sequenceNo}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowAddress}>{item.addressLine ?? item.city ?? ""}</Text>
            </View>
            <Text style={[styles.rowStatus, { color: STATUS_COLOR[item.visitStatus] }]}>
              {STATUS_LABEL[item.visitStatus]}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  beatName: { fontSize: 18, fontWeight: "700", flexShrink: 1 },
  logout: { color: "#c0392b", fontSize: 14 },
  error: { color: "#c0392b", marginHorizontal: 16, marginTop: 8 },
  actionsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1a56db",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#1a56db", fontWeight: "600", fontSize: 13 },
  empty: { textAlign: "center", color: "#666", marginTop: 40, paddingHorizontal: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowSeq: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#f1f1f1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowSeqText: { fontSize: 12, fontWeight: "600", color: "#555" },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "600" },
  rowAddress: { fontSize: 12, color: "#888", marginTop: 2 },
  rowStatus: { fontSize: 12, fontWeight: "600", marginLeft: 8 },
});
