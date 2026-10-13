import { useState } from "react";

import Page from "../../../../components/Page/Page";
import type { Friend } from "@concorde/shared";
import AcceptedFriendsList from "./AcceptedFriendsListProps";
import AddFriendCard from "./AddFriendCard";
import ChatView from "./ChatView/ChatView";
import IncomingRequestsList from "./IncomingRequestsList";
import { useCallInviteState } from "../../../../contexts/CallInviteProvider";
import { useToast } from "../../../../contexts/ToastProvider";

import { api, getErrorMessage } from "../../../../api/api";
import { useFriendRequest } from "../../../../hooks/useFriend";
import { useFriendsList } from "../../../../hooks/useFriendsList";
import { useIncomingRequests } from "../../../../hooks/useIncomingRequests";

import styles from "./Friends.module.css";

interface FriendsProps {
    activeChannelId: string | null;
    onActiveChannel: (activeChannelId: string | null) => void;
    onSelectFriend: (selectedFriend: Friend | null) => void;
    selectedFriend: Friend | null;
    hidden: boolean;
}

export default function Friends({ activeChannelId, onActiveChannel, onSelectFriend, selectedFriend, hidden = false }: FriendsProps) {
    const { friends, loading, load, remove, error: errorFriendsList } = useFriendsList();
    const { query, add, setQuery, state } = useFriendRequest();
    const { accept, decline, requests, loadRequests, loading: loadingRequests, error: errorRequests } = useIncomingRequests();
    const [tab, setTab] = useState<"requests" | "friends">("friends");
    const { dial } = useCallInviteState();

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
                <AddFriendCard
                    query={query}
                    state={state}
                    onQueryChange={setQuery}
                    onAdd={handleAdd}
                />

                <div className={styles.lists}>
                    <div className={styles.tabNav}>
                        <button
                            type="button"
                            className={styles.tabBtn}
                            disabled={tab === "friends"}
                            onClick={() => setTab("friends")}
                        >
                            Amigos
                        </button>

                        <button
                            type="button"
                            className={styles.tabBtn}
                            disabled={tab === "requests"}
                            onClick={() => setTab("requests")}
                        >
                            Pendentes
                        </button>
                    </div>

                    {tab === "friends" && (
                        <AcceptedFriendsList
                            friends={friends}
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