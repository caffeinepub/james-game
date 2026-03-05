import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function useGetHighScore() {
  const { actor, isFetching } = useActor();
  return useQuery<bigint>({
    queryKey: ["highScore"],
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getHighScore();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}
