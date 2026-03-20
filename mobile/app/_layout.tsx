import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../src/stores/auth";

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
          headerStyle: { backgroundColor: "#fff" },
          headerTitleStyle: { fontWeight: "600" },
        }}
      />
      <Stack.Screen
        name="income"
        options={{
          headerShown: true,
          title: "Income Summary",
          headerStyle: { backgroundColor: "#fff" },
          headerTitleStyle: { fontWeight: "600" },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
