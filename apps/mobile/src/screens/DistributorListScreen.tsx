import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { DistributorSummary } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError, useAuth } from "../context/AuthContext";
import { useDistributor } from "../context/DistributorContext";

type Props = NativeStackScreenProps<RootStackParamList, "DistributorList">;

// Two ways to land here (see RootNavigator): as the sole screen when
// accessToken is set but no distributor has been picked yet — nothing to go
// back to, so setting context state is itself what flips RootNavigator to
// the next screen set (same pattern as the accessToken gate/login) — or
// pushed on top of an existing stack via "Switch" once a distributor is
// already selected, where picking a new one has to explicitly pop back
// instead, since that top-level branch doesn't change and nothing
// auto-navigates. canGoBack() is what tells the two apart.
export default function DistributorListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const { setDistributor } = useDistributor();
  const [distributors, setDistributors] = useState<DistributorSummary[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await authedRequest<{ distributors: DistributorSummary[] }>("get", "/distributors");
        if (cancelled) return;
        // The common pilot case — one salesman, one distributor — skips
        // this screen entirely rather than making every login pick from a
        // list of one. Multiple distributors is when picking actually
        // matters, so that's the only case this screen stays visible for.
        if (result.distributors.length === 1) {
          setDistributor(result.distributors[0]);
          if (navigation.canGoBack()) navigation.popToTop();
          return;
        }
        setDistributors(result.distributors);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
          setDistributors([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation, setDistributor]);

  const selectDistributor = (d: DistributorSummary) => {
    setDistributor(d);
    if (navigation.canGoBack()) navigation.popToTop();
  };

  if (distributors === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Select a distributor</Text>
        <Pressable onPress={logout}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <FlatList
        data={distributors}
        keyExtractor={(d) => d.id}
        ListEmptyComponent={
          !errorMessage ? (
            <Text style={styles.empty}>Your account isn't assigned to any distributor yet.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => selectDistributor(item)}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowCode}>{item.code}</Text>
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
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "700" },
  logout: { color: "#c0392b", fontSize: 14 },
  error: { color: "#c0392b", marginHorizontal: 16, marginTop: 8 },
  empty: { textAlign: "center", color: "#666", marginTop: 40, paddingHorizontal: 24 },
  row: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowName: { fontSize: 16, fontWeight: "600" },
  rowCode: { fontSize: 12, color: "#888", marginTop: 2 },
});
