import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { BeatRetailerListResponse } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "BeatRetailerList">;

export default function BeatRetailerListScreen({ route, navigation }: Props) {
  const { beatId } = route.params;
  const [data, setData] = useState<BeatRetailerListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
          const result = await authedRequest<BeatRetailerListResponse>("get", `/beats/${beatId}/retailers`);
          if (!cancelled) setData(result);
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
    }, [beatId])
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
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <FlatList
        data={data?.retailers ?? []}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text style={styles.empty}>No retailers on this beat.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              data &&
              navigation.navigate("RetailerDetail", {
                retailerId: item.id,
                retailerName: item.name,
                distributorId: data.distributorId,
                beatId: data.beatId,
              })
            }
          >
            <View style={styles.rowSeq}>
              <Text style={styles.rowSeqText}>{item.sequenceNo}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowAddress}>{item.addressLine ?? item.city ?? ""}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: "#c0392b", marginHorizontal: 16, marginTop: 8 },
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
});
