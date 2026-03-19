import { Redirect } from "expo-router";
import { useAuthStore } from "../src/stores/auth";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
