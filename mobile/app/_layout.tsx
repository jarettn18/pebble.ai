import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useAuthStore } from "../src/stores/auth";
import { colors, fonts } from "../src/theme";
import GlobalChatFAB from "../src/components/GlobalChatFAB";
import ChatSheet from "../src/components/ChatSheet";
import SimulatorFrame from "../src/components/SimulatorFrame";

function AuthGate() {
  const { isAuthenticated, isLoading, loadUser, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboardingGroup = segments[0] === "(onboarding)";
    const needsOnboarding =
      isAuthenticated && user && !user.onboarding_completed;

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      if (needsOnboarding) {
        router.replace("/(onboarding)/occupation");
      } else {
        router.replace("/(tabs)");
      }
    } else if (needsOnboarding && !inOnboardingGroup) {
      router.replace("/(onboarding)/occupation");
    } else if (
      isAuthenticated &&
      user?.onboarding_completed &&
      inOnboardingGroup
    ) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, user]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="spending"
        options={{
          headerShown: true,
          title: "Spending Summary",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semiBold },
        }}
      />
      <Stack.Screen
        name="income"
        options={{
          headerShown: true,
          title: "Income Summary",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semiBold },
        }}
      />
      <Stack.Screen
        name="add-asset"
        options={{
          headerShown: true,
          title: "Add Asset",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semiBold },
        }}
      />
      <Stack.Screen
        name="asset/[id]"
        options={{
          headerShown: true,
          title: "Asset Details",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semiBold },
        }}
      />
      <Stack.Screen
        name="budget-transactions"
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semiBold },
        }}
      />
      <Stack.Screen
        name="account-transactions"
        options={{
          headerShown: true,
          title: "Account Details",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semiBold },
        }}
      />
      <Stack.Screen
        name="import-csv"
        options={{
          headerShown: true,
          title: "Import Transactions",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semiBold },
        }}
      />
      </Stack>
      <GlobalChatFAB />
      <ChatSheet />
    </>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SimulatorFrame>
        <BottomSheetModalProvider>
          <AuthGate />
        </BottomSheetModalProvider>
      </SimulatorFrame>
    </GestureHandlerRootView>
  );
}
