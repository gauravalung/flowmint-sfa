import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { BeatSummary } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";
import { useDistributor } from "../context/DistributorContext";

type Props = NativeStackScreenProps<RootStackParamList, "BeatList">;

export default function BeatListScreen({ navigation }: Props) {
  const { distributor } = useDistributor();
  const [beats, setBeats] = useState<BeatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!distributor) return;
      let cancelled = false;
      (async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
          const result = await authedRequest<{ beats: BeatSummary[] }>(
            "get",
            `/me/distributors/${distributor.id}/beats`
          );
          if (!cancelled) setBeats(result.beats);
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
    }, [distributor])
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>{distributor?.name}</Text>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <FlatList
        data={beats}
        keyExtractor={(b) => b.id}
        ListEmptyComponent={<Text style={styles.empty}>No beats under this distributor.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("BeatRetailerList", { beatId: item.id, beatName: item.name })}
          >
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
  subtitle: { fontSize: 13, color: "#666", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  error: { color: "#c0392b", marginHorizontal: 16 },
  empty: { textAlign: "center", color: "#666", marginTop: 40, paddingHorizontal: 24 },
  row: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowName: { fontSize: 15, fontWeight: "600" },
  rowCode: { fontSize: 12, color: "#888", marginTop: 2 },
});
