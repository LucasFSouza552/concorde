import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import ProfilePanel, { type ProfilePanelActions, type ProfileUser } from "../components/ProfilePanel/ProfilePanel";

export interface ProfileOptions {
    roleLabel?: string;
    actions?: ProfilePanelActions;
    extra?: ReactNode;
}

interface ProfileEntry {
    user: ProfileUser;
    options?: ProfileOptions;
    key: number;
}

interface ProfileContextData {
    openProfile: (user: ProfileUser, options?: ProfileOptions) => void;
    closeProfile: () => void;
}

const ProfileContext = createContext<ProfileContextData | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
    const [entry, setEntry] = useState<ProfileEntry | null>(null);
    const nextKey = useRef(0);

    const openProfile = useCallback((user: ProfileUser, options?: ProfileOptions) => {
        nextKey.current += 1;
        setEntry({ user, options, key: nextKey.current });
    }, []);

    const closeProfile = useCallback(() => setEntry(null), []);

    const panelActions = useMemo<ProfilePanelActions>(() => {
        if (!entry) return {};
        const source = entry.options?.actions;
        return {
            ...source,
            onEdit: source?.onEdit ? () => {
                closeProfile();
                source.onEdit?.();
            } : undefined,
            onOpenProfile: (user) => openProfile(user, { actions: source }),
        };
    }, [closeProfile, entry, openProfile]);

    const value = useMemo<ProfileContextData>(
        () => ({ openProfile, closeProfile }),
        [closeProfile, openProfile]
    );

    return (
        <ProfileContext.Provider value={value}>
            {children}
            {entry && (
                <ProfilePanel
                    key={entry.key}
                    user={entry.user}
                    onClose={closeProfile}
                    roleLabel={entry.options?.roleLabel}
                    actions={panelActions}
                    extra={entry.options?.extra}
                />
            )}
        </ProfileContext.Provider>
    );
}

export function useProfile(): ProfileContextData {
    const context = useContext(ProfileContext);
    if (!context) throw new Error("useProfile must be used inside a ProfileProvider");
    return context;
}
