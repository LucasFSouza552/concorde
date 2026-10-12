import { useState } from "react";

import type { Friend } from "@concorde/shared";
import AcceptedFriendsList from "./AcceptedFriendsListProps";
import AddFriendCard from "./AddFriendCard";
import ChatView from "./ChatView/ChatView";
import IncomingRequestsList from "./IncomingRequestsList";
import { useCallInviteState } from "../../../../contexts/CallInviteProvider";

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
}

export default function Friends({ activeChannelId, onActiveChannel, onSelectFriend, selectedFriend }: FriendsProps) {
    const [error, setError] = useState<string | null>(null);
    const { friends, loading, load, remove, error: errorFriendsList } = useFriendsList();
    const { query, add, setQuery, state } = useFriendRequest();
    const { accept, decline, requests, loadRequests, loading: loadingRequests, error: errorRequests } = useIncomingRequests();
    const [tab, setTab] = useState<"requests" | "friends">("friends");
    const { dial } = useCallInviteState();

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
            setError(getErrorMessage(error));
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
            setError(getErrorMessage(error));
        }
    }

    if (activeChannelId && selectedFriend) {
        return (
            <ChatView
                channelId={activeChannelId}
                friend={selectedFriend}
                onBack={handleCloseChat}
            />
        );
    }

    return (
        <section className={styles.container}>

            <AddFriendCard
                query={query}
                state={state}
                onQueryChange={setQuery}
                onAdd={add}
            />
            <div className={styles.lists}>
                <div className={styles.tabNav}>
                    <button type="button" className={styles.tabBtn} disabled={tab === "friends"} onClick={() => setTab("friends")}>Amigos</button>
                    <button type="button" className={styles.tabBtn} disabled={tab === "requests"} onClick={() => setTab("requests")}>Pendente</button>
                </div>

                {tab === "requests" && <IncomingRequestsList
                    requests={requests}
                    loading={loadingRequests}
                    error={errorRequests}
                    onAccept={handleAccept}
                    onDecline={decline}
                    onReload={loadRequests}
                />}

                {tab === "friends" && <AcceptedFriendsList
                    friends={friends}
                    loading={loading}
                    error={errorFriendsList}
                    onReload={load}
                    onRemove={remove}
                    onChat={handleOpenChat}
                    onCall={handleCall} />}

            </div>
        </section>
    )
}