import React, { useCallback, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { RetailerSummary } from "@flowmint/shared";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "OffBeatSearch">;

interface SearchResponse {
  retailers: RetailerSummary[];
  total: number;
}

export default function OffBeatSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RetailerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runSearch = useCallback(async (text: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await authedRequest<SearchResponse>(
        "get",
        `/retailers?search=${encodeURIComponent(text)}&pageSize=30`
      );
      setResults(result.retailers);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, []);

  // Any beat retailer this salesman visits regularly already shows up on
  // Today's Beat — this search exists specifically for the retailers who
  // aren't on it, so it starts pre-loaded with the full distributor list
  // rather than waiting for the first keystroke.
  React.useEffect(() => {
    runSearch("");
  }, [runSearch]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          runSearch(text);
        }}
        placeholder="Search by retailer name or code"
        autoCorrect={false}
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}

      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          hasSearched && !isLoading ? <Text style={styles.empty}>No retailers found.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              navigation.navigate("RetailerDetail", {
                retailerId: item.id,
                retailerName: item.name,
                beatId: null,
              })
            }
          >
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowAddress}>{item.addressLine ?? item.city ?? item.code}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  input: {
    margin: 16,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: "#c0392b", marginHorizontal: 16 },
  loader: { marginTop: 8 },
  empty: { textAlign: "center", color: "#666", marginTop: 40 },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowName: { fontSize: 15, fontWeight: "600" },
  rowAddress: { fontSize: 12, color: "#888", marginTop: 2 },
});
