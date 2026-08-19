import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";

// Placeholder landing screen for Slice A — Today's Beat (Slice B), catalog
// and orders (Slice C/D) replace this once those slices are built.
export default function HomeScreen() {
  const { logout } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're logged in.</Text>
      <Text style={styles.subtitle}>Today's Beat lands in Slice B.</Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  button: { backgroundColor: "#c0392b", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
