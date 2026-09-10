import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useDistributor } from "../context/DistributorContext";
import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordRequestScreen from "../screens/ForgotPasswordRequestScreen";
import ForgotPasswordVerifyScreen from "../screens/ForgotPasswordVerifyScreen";
import ForgotPasswordResetScreen from "../screens/ForgotPasswordResetScreen";
import DistributorListScreen from "../screens/DistributorListScreen";
import BeatListScreen from "../screens/BeatListScreen";
import BeatRetailerListScreen from "../screens/BeatRetailerListScreen";
import TodayBeatScreen from "../screens/TodayBeatScreen";
import RetailerDetailScreen from "../screens/RetailerDetailScreen";
import CloseVisitScreen from "../screens/CloseVisitScreen";
import OffBeatSearchScreen from "../screens/OffBeatSearchScreen";
import AddOutletScreen from "../screens/AddOutletScreen";
import AddOutletOtpScreen from "../screens/AddOutletOtpScreen";
import ProductCatalogScreen from "../screens/ProductCatalogScreen";
import CartScreen from "../screens/CartScreen";

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
  DistributorList: undefined;
  BeatList: undefined;
  BeatRetailerList: { beatId: string; beatName: string };
  Home: undefined;
  RetailerDetail: {
    retailerId: string;
    retailerName: string;
    distributorId: string;
    beatId?: string | null;
    visitId?: string | null;
    visitStatus?: "PENDING" | "IN_PROGRESS" | "ORDER_BOOKED" | "NO_ORDER";
  };
  CloseVisit: { visitId: string; retailerName: string };
  OffBeatSearch: undefined;
  AddOutlet: undefined;
  AddOutletOtp: { draft: NewOutletDraft };
  ProductCatalog: { retailerId: string; retailerName: string; distributorId: string; visitId: string };
  Cart: { retailerId: string; retailerName: string; distributorId: string; visitId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { accessToken, isLoading } = useAuth();
  const { distributor, setDistributor } = useDistributor();

  // DistributorContext doesn't know about auth — clearing it here (rather
  // than inside AuthContext.logout, a separate context) means a stale
  // selection from a previous session never leaks into the next login,
  // whether that's an explicit log-out or an unrecoverable 401 dropping the
  // app back to Login on its own.
  React.useEffect(() => {
    if (!accessToken && distributor) setDistributor(null);
  }, [accessToken, distributor, setDistributor]);

  if (isLoading) return null; // splash could go here later

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTitleAlign: "center" }}>
        {!accessToken ? (
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
        ) : !distributor ? (
          // Logged in but hasn't picked a distributor yet — the sole screen
          // here. Picking one (or having exactly one, auto-picked) flips
          // `distributor` truthy, which re-renders this whole component
          // into the branch below, same as the accessToken gate above.
          <Stack.Screen
            name="DistributorList"
            component={DistributorListScreen}
            options={{ title: "Select Distributor", headerShown: false }}
          />
        ) : (
          <>
            {/* Registered again here (not just above) so "Switch" from Home
                can push it as a normal screen instead of relying on the
                gate — see DistributorListScreen's canGoBack() check. */}
            <Stack.Screen
              name="DistributorList"
              component={DistributorListScreen}
              options={{ title: "Switch Distributor" }}
            />
            <Stack.Screen name="BeatList" component={BeatListScreen} options={{ title: "Beats" }} />
            <Stack.Screen
              name="BeatRetailerList"
              component={BeatRetailerListScreen}
              options={({ route }) => ({ title: route.params.beatName })}
            />
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
            <Stack.Screen
              name="ProductCatalog"
              component={ProductCatalogScreen}
              options={{ title: "New Order" }}
            />
            <Stack.Screen name="Cart" component={CartScreen} options={{ title: "Cart" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
