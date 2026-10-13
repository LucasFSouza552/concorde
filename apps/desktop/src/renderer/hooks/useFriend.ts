import { useCallback, useState } from "react";

import { api, getErrorMessage } from "../api/api";

export type AddState =
    | { status: "idle" }
    | { status: "sending" }
    | { status: "sent"; username: string }
    | { status: "error"; message: string };

export function useFriendRequest() {
    const [query, setQuery] = useState("");
    const [state, setState] = useState<AddState>({ status: "idle" });

    const add = useCallback(async (): Promise<string | null> => {
        const username = query.trim();
        if (!username) return null;

        setState({ status: "sending" });
        try {
            await api.post("/friends/requests", { username });
            setState({ status: "sent", username });
            return username
        } catch (error) {
            const message = getErrorMessage(error);
            setState({ status: "error", message });
            throw new Error(message);

        }
    }, [query]);

    const reset = useCallback(() => {
        setQuery("");
        setState({ status: "idle" });
    }, []);

    return { query, setQuery, state, add, reset };

}