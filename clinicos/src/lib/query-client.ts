import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 0 retry → échoue vite, affiche les mock data immédiatement
      retry: 0,
      // Ne pas reessayer si erreur réseau (backend offline)
      retryOnMount: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Ne pas refetch en arrière-plan si backend offline
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
