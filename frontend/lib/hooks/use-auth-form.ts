import { useState } from "react";

export function useAuthForm() {
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    async function run(fn: () => Promise<void>) {
        setIsLoading(true);
        setError(null);
        try {
            await fn();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsLoading(false);
        }
    }

    return { error, isLoading, run };
}
