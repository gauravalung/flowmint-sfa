import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Tokens live in the device's secure storage (Keychain on iOS, Keystore-
// backed EncryptedSharedPreferences on Android) — never AsyncStorage/
// localStorage, which are plain-text on disk.
//
// expo-secure-store has no native module on web (it's a keychain/keystore
// wrapper), so calling it there throws. This app only ever runs on Android
// in production; the localStorage fallback below exists purely so
// `npx expo start --web` — used as a browser preview during development,
// never for real deployment — has somewhere to put tokens instead of
// crashing on login. Never used on-device.
const ACCESS_TOKEN_KEY = "flowmint.accessToken";
const REFRESH_TOKEN_KEY = "flowmint.refreshToken";
const isWeb = Platform.OS === "web";

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function loadTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const [accessToken, refreshToken] = isWeb
    ? [window.localStorage.getItem(ACCESS_TOKEN_KEY), window.localStorage.getItem(REFRESH_TOKEN_KEY)]
    : await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
