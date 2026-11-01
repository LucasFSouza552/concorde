import { useCallback, useEffect, useState } from "react";

import type { Friend } from "@concorde/shared";

import { api, getErrorMessage } from "../api/api";
import { useUserSocketEvent } from "../contexts/UserSocketProvider";

export function useIncomingRequests() {
    const [requests, setRequests] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data } = await api.get<{ requests: Friend[] }>("/friends/requests");

            setRequests(data.requests);
        } catch (error) {
            console.log(error);
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    // Pedido novo chegando: aparece na aba Pendentes na hora.
    const lastEvent = useUserSocketEvent();
    useEffect(() => {
        if (lastEvent?.type !== "friends-changed") return;

        // Carregamento fora do corpo síncrono do efeito (evita re-render cascata).
        const timer = setTimeout(() => { void loadRequests(); }, 0);
        return () => clearTimeout(timer);
    }, [lastEvent, loadRequests]);

    const accept = useCallback(async (friendId: string) => {
        try {
            await api.post(`/friends/requests/${friendId}/accept`);
            await loadRequests();
        } catch (error) {
            setError(getErrorMessage(error));
        }
    }, [loadRequests]);

    const decline = useCallback(async (friendId: string) => {
        try {
            await api.post(`/friends/requests/${friendId}/decline`);
            await loadRequests();
        } catch (error) {
            setError(getErrorMessage(error));
        }
    }, [loadRequests]);

    return {
        requests,
        loading,
        error,
        loadRequests,
        accept,
        decline
    };

}