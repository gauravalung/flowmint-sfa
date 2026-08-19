import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordRequestScreen from "../screens/ForgotPasswordRequestScreen";
import ForgotPasswordVerifyScreen from "../screens/ForgotPasswordVerifyScreen";
import ForgotPasswordResetScreen from "../screens/ForgotPasswordResetScreen";
import TodayBeatScreen from "../screens/TodayBeatScreen";
import RetailerDetailScreen from "../screens/RetailerDetailScreen";
import CloseVisitScreen from "../screens/CloseVisitScreen";
import OffBeatSearchScreen from "../screens/OffBeatSearchScreen";
import AddOutletScreen from "../screens/AddOutletScreen";
import AddOutletOtpScreen from "../screens/AddOutletOtpScreen";

export type NewOutletDraft = {
  name: string;
  ownerName?: string;
  addressLine?: string;
  city?: string;
  pincode?: string;
  phone: string;
};

export type RootStackParamList = {
  Login: undefined;
  ForgotPasswordRequest: undefined;
  ForgotPasswordVerify: { employeeCode: string };
  ForgotPasswordReset: { resetToken: string };
  Home: undefined;
  RetailerDetail: {
    retailerId: string;
    retailerName: string;
    beatId?: string | null;
    visitId?: string | null;
    visitStatus?: "PENDING" | "IN_PROGRESS" | "ORDER_BOOKED" | "NO_ORDER";
  };
  CloseVisit: { visitId: string; retailerName: string };
  OffBeatSearch: undefined;
  AddOutlet: undefined;
  AddOutletOtp: { draft: NewOutletDraft };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { accessToken, isLoading } = useAuth();

  if (isLoading) return null; // splash could go here later

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTitleAlign: "center" }}>
        {accessToken ? (
          <>
            <Stack.Screen name="Home" component={TodayBeatScreen} options={{ title: "Today's Beat" }} />
            <Stack.Screen
              name="RetailerDetail"
              component={RetailerDetailScreen}
              options={({ route }) => ({ title: route.params.retailerName })}
            />
            <Stack.Screen name="CloseVisit" component={CloseVisitScreen} options={{ title: "Close Visit" }} />
            <Stack.Screen
              name="OffBeatSearch"
              component={OffBeatSearchScreen}
              options={{ title: "Find Retailer" }}
            />
            <Stack.Screen name="AddOutlet" component={AddOutletScreen} options={{ title: "New Outlet" }} />
            <Stack.Screen
              name="AddOutletOtp"
              component={AddOutletOtpScreen}
              options={{ title: "Verify Shop Phone" }}
            />
          </>
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
