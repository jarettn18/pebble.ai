import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
} from "@expo-google-fonts/inter";
import { useAuthStore } from "../src/stores/auth";
import { colors } from "../src/theme";

const queryClient = new QueryClient();

function AuthGate() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="spending"
        options={{
          headerShown: true,
          title: "Spending Summary",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
        }}
      />
      <Stack.Screen
        name="income"
        options={{
          headerShown: true,
          title: "Income Summary",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
        }}
      />
      <Stack.Screen
        name="add-asset"
        options={{
          headerShown: true,
          title: "Add Asset",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
        }}
      />
      <Stack.Screen
        name="asset/[id]"
        options={{
          headerShown: true,
          title: "Asset Details",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
        }}
      />
      <Stack.Screen
        name="budget-transactions"
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
        }}
      />
      <Stack.Screen
        name="account-transactions"
        options={{
          headerShown: true,
          title: "Account Details",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: "600", fontFamily: "PlusJakartaSans_600SemiBold" },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
