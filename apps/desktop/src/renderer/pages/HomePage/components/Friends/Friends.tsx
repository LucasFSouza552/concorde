import { useMemo, useState } from "react";

import Page from "../../../../components/Page/Page";
import type { Friend, UserStatus } from "@concorde/shared";
import AcceptedFriendsList from "./AcceptedFriendsListProps";
import AddFriendCard from "./AddFriendCard";
import ChatView from "./ChatView/ChatView";
import IncomingRequestsList from "./IncomingRequestsList";
import { useCallInviteState } from "../../../../contexts/CallInviteProvider";
import { useToast } from "../../../../contexts/ToastProvider";

import { api, getErrorMessage } from "../../../../api/api";
import { useFriendRequest } from "../../../../hooks/useFriend";
import { useFriendsList } from "../../../../hooks/useFriendsList";
import { useFriendsPresence } from "../../../../hooks/useFriendsPresence";
import { useIncomingRequests } from "../../../../hooks/useIncomingRequests";

import styles from "./Friends.module.css";

interface FriendsProps {
    activeChannelId: string | null;
    onActiveChannel: (activeChannelId: string | null) => void;
    onSelectFriend: (selectedFriend: Friend | null) => void;
    selectedFriend: Friend | null;
    hidden: boolean;
}

type FriendsTab = "available" | "all" | "requests" | "add";

const TABS: { id: FriendsTab; label: string }[] = [
    { id: "available", label: "Disponível" },
    { id: "all", label: "Todos" },
    { id: "requests", label: "Pendentes" },
    { id: "add", label: "Adicionar Amigos" },
];

function statusRank(status: UserStatus | undefined) {
    if (status === "online") return 0;
    if (status === "away" || status === "busy") return 1;
    return 2;
}

function isAvailable(status: UserStatus | undefined) {
    return status !== undefined && status !== "offline";
}

export default function Friends({ activeChannelId, onActiveChannel, onSelectFriend, selectedFriend, hidden = false }: FriendsProps) {
    const { friends, loading, load, remove, error: errorFriendsList } = useFriendsList();
    const { query, add, setQuery, state } = useFriendRequest();
    const { accept, decline, requests, loadRequests, loading: loadingRequests, error: errorRequests } = useIncomingRequests();
    const [tab, setTab] = useState<FriendsTab>("all");
    const { dial } = useCallInviteState();

    const presences = useFriendsPresence(friends);

    const availableFriends = useMemo(
        () => friends.filter((friend) => isAvailable(presences.get(friend.id)?.status)),
        [friends, presences],
    );

    const sortedFriends = useMemo(
        () => [...friends].sort((a, b) => {
            const delta = statusRank(presences.get(a.id)?.status) - statusRank(presences.get(b.id)?.status);
            return delta !== 0 ? delta : a.displayName.localeCompare(b.displayName);
        }),
        [friends, presences],
    );

    const isChatOpen = Boolean(activeChannelId && selectedFriend);

    const { push } = useToast();

    async function handleAccept(friendId: string) {
        await accept(friendId);
        await load();
    }

    async function handleOpenChat(friend: Friend) {
        try {
            const { data } = await api.post<{ channel: { id: string } }>(
                "/channels/dm",
                { toUserId: friend.id }
            );

            onSelectFriend(friend);
            onActiveChannel(data.channel.id);
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    function handleCloseChat() {
        onActiveChannel(null);
        onSelectFriend(null);
    }

    async function handleCall(friend: Friend) {
        try {
            await dial(friend);
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    async function handleAdd() {
        try {
            const username = await add();
            if (!username) return;
            push(`Pedido enviado para @${username}!`, "success");
            setQuery("");
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    return (
        <>
            <Page hidden={hidden || isChatOpen}>
                <div className={styles.lists}>
                    <nav className={styles.tabNav} role="tablist" aria-label="Filtrar amigos">
                        {TABS.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === entry.id}
                                className={`${styles.tabBtn} ${tab === entry.id ? styles.tabBtnActive : ""}`}
                                onClick={() => setTab(entry.id)}
                            >
                                {entry.label}
                                {entry.id === "requests" && requests.length > 0 && (
                                    <span className={styles.tabBadge}>{requests.length}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {(tab === "available" || tab === "all") && (
                        <AcceptedFriendsList
                            friends={tab === "available" ? availableFriends : sortedFriends}
                            presences={presences}
                            title={tab === "available" ? "Amigos disponíveis" : "Meus amigos"}
                            loading={loading}
                            error={errorFriendsList}
                            onReload={load}
                            onRemove={remove}
                            onChat={handleOpenChat}
                            onCall={handleCall}
                        />
                    )}

                    {tab === "requests" && (
                        <IncomingRequestsList
                            requests={requests}
                            loading={loadingRequests}
                            error={errorRequests}
                            onAccept={handleAccept}
                            onDecline={decline}
                            onReload={loadRequests}
                        />
                    )}

                    {tab === "add" && (
                        <AddFriendCard
                            query={query}
                            state={state}
                            onQueryChange={setQuery}
                            onAdd={handleAdd}
                        />
                    )}
                </div>
            </Page>

            {isChatOpen && !hidden && activeChannelId && selectedFriend && (
                <ChatView
                    channelId={activeChannelId}
                    friend={selectedFriend}
                    onBack={handleCloseChat}
                />
            )}
        </>
    );
}
