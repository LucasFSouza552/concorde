import { useCallback, useEffect, useState } from "react";

import type { ChannelKind } from "@concorde/shared";

import { api, getErrorMessage } from "../api/api";

export interface ChannelListItem {
    id: string;
    groupId: string | null;
    kind: ChannelKind;
    name: string | null;
    createdAt: number;
}

export function useChannels() {
    const [channels, setChannels] = useState<ChannelListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data } = await api.get<{ channels: ChannelListItem[] }>("/channels");
            setChannels(data.channels);
        } catch (error) {
            setError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        function handleChanged() {
            void load();
        }

        window.addEventListener("concorde:groups-changed", handleChanged);
        return () => window.removeEventListener("concorde:groups-changed", handleChanged);
    }, [load]);

    return { channels, load, loading, error };

}