import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { api, ApiRequestError } from "../api/client";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPasswordRequest">;

export default function ForgotPasswordRequestScreen({ navigation }: Props) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRequest = async () => {
    if (!employeeCode.trim()) {
      setMessage("Enter your employee code.");
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await api.post<{ message: string }>("/auth/forgot-password/request", {
        employeeCode: employeeCode.trim(),
      });
      // Server always returns the same message whether or not the code
      // exists — deliberate, prevents account enumeration.
      setMessage(res.message);
      navigation.navigate("ForgotPasswordVerify", { employeeCode: employeeCode.trim() });
    } catch (err) {
      setMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>Enter your employee code. We'll send an OTP to your registered phone.</Text>

      <TextInput
        style={styles.input}
        value={employeeCode}
        onChangeText={setEmployeeCode}
        placeholder="Employee code"
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {message ? <Text style={styles.info}>{message}</Text> : null}

      <Pressable style={styles.button} onPress={handleRequest} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  info: { marginTop: 16, fontSize: 13, color: "#1a56db" },
  button: { backgroundColor: "#1a7f37", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
