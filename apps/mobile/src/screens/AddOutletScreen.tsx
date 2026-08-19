import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { authedRequest } from "../auth/tokenStore";
import { ApiRequestError } from "../context/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "AddOutlet">;

export default function AddOutletScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendOtp = async () => {
    setErrorMessage(null);
    if (name.trim().length < 2) {
      setErrorMessage("Enter the shop name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setErrorMessage("Enter a valid 10-digit mobile number.");
      return;
    }
    setIsSubmitting(true);
    try {
      await authedRequest("post", "/retailers/otp/request", { phone: phone.trim() });
      navigation.navigate("AddOutletOtp", {
        draft: {
          name: name.trim(),
          ownerName: ownerName.trim() || undefined,
          addressLine: addressLine.trim() || undefined,
          city: city.trim() || undefined,
          pincode: pincode.trim() || undefined,
          phone: phone.trim(),
        },
      });
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        This creates a new outlet immediately after the shop's phone number is verified.
      </Text>

      <Text style={styles.label}>Shop Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Sharma General Store" />

      <Text style={styles.label}>Owner Name</Text>
      <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Optional" />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={addressLine} onChangeText={setAddressLine} placeholder="Optional" />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>City</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Optional" />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Pincode</Text>
          <TextInput
            style={styles.input}
            value={pincode}
            onChangeText={setPincode}
            placeholder="Optional"
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>
      </View>

      <Text style={styles.label}>Shop Mobile Number *</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="10-digit mobile number"
        keyboardType="phone-pad"
        maxLength={10}
      />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable style={styles.button} onPress={handleSendOtp} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 40 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 20 },
  label: { fontSize: 13, color: "#333", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  error: { color: "#c0392b", marginTop: 16 },
  button: { backgroundColor: "#1a7f37", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 28 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
