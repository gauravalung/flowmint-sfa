import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordRequestScreen from "../screens/ForgotPasswordRequestScreen";
import ForgotPasswordVerifyScreen from "../screens/ForgotPasswordVerifyScreen";
import ForgotPasswordResetScreen from "../screens/ForgotPasswordResetScreen";
import HomeScreen from "../screens/HomeScreen";

export type RootStackParamList = {
  Login: undefined;
  ForgotPasswordRequest: undefined;
  ForgotPasswordVerify: { employeeCode: string };
  ForgotPasswordReset: { resetToken: string };
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { accessToken, isLoading } = useAuth();

  if (isLoading) return null; // splash could go here later

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTitleAlign: "center" }}>
        {accessToken ? (
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Flowmint SFA" }} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="ForgotPasswordRequest"
              component={ForgotPasswordRequestScreen}
              options={{ title: "Forgot Password" }}
            />
            <Stack.Screen
              name="ForgotPasswordVerify"
              component={ForgotPasswordVerifyScreen}
              options={{ title: "Verify OTP" }}
            />
            <Stack.Screen
              name="ForgotPasswordReset"
              component={ForgotPasswordResetScreen}
              options={{ title: "New Password" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
