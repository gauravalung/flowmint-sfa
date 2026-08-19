import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "AddOutletOtp">;

export default function AddOutletOtpScreen({ route, navigation }: Props) {
  const { draft } = route.params;
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVerifyAndCreate = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setErrorMessage("Enter the 6-digit OTP.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const { verificationToken } = await authedRequest<{ verificationToken: string }>(
        "post",
        "/retailers/otp/verify",
        { phone: draft.phone, otp }
      );
      await authedRequest("post", "/retailers", { ...draft, verificationToken });
      navigation.popToTop();
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {draft.phone}.</Text>

      <TextInput
        style={styles.input}
        value={otp}
        onChangeText={setOtp}
        placeholder="6-digit OTP"
        keyboardType="number-pad"
        maxLength={6}
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable style={styles.button} onPress={handleVerifyAndCreate} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Create Outlet</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 4,
    textAlign: "center",
  },
  error: { color: "#c0392b", marginTop: 12, fontSize: 14 },
  button: { backgroundColor: "#1a7f37", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
