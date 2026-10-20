import { useCallback, useEffect, useState } from "react";

import type { GroupWithRole } from "@concorde/shared";

import { api, getErrorMessage } from "../api/api";

export function notifyGroupsChanged() {
    window.dispatchEvent(new Event("concorde:groups-changed"));
}

export function useGroupsList() {
    const [groups, setGroups] = useState<GroupWithRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data } = await api.get<{ groups: GroupWithRole[] }>("/groups");
            setGroups(data.groups);
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

    return { groups, loading, error, load };
}