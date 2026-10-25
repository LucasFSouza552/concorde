import { useEffect, useRef, useState } from "react"

import SideBar from "../../components/SideBar/SideBar"
import UserDock, { type ConversationTab } from "../../components/UserDock/UserDock"
import CallScreen from "../../components/CallScreen/CallScreen";
import GroupPage from "./components/Home/GroupPage";
import Home from './components/Home/Home';
import ChatView from "./components/Friends/ChatView/ChatView";
import type { Friend, GroupRole } from "@concorde/shared";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useCallInviteState } from "../../contexts/CallInviteProvider";
import { useToast } from "../../contexts/ToastProvider";
import { useUI } from "../../contexts/UIContext";
import { Users } from "lucide-react";

import { api, getErrorMessage } from "../../api/api";
import { GlobalRemoteAudio } from '../../hooks/GlobalRemoteAudio';
import type { ActiveCallEntry } from "../../hooks/useActiveCalls";

import styles from "./HomePage.module.css";

interface ChatState {
    channelId: string;
    friend: Friend;
}

export default function HomePage() {
    const { groupId, peers } = useActiveCall();
    const { outgoing, joinedGroup, joinGroupCall } = useCallInviteState();
    const { sidebarOpen, toggleSidebar } = useUI();
    const [chat, setChat] = useState<ChatState | null>(null);
    const [tabs, setTabs] = useState<ConversationTab[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string; role: GroupRole } | null>(null);
    const lastCallPeer = useRef<{ userId: string; displayName: string } | null>(null);
    const groupCallRef = useRef(false);
    const { push } = useToast();

    function openDmTab(friend: Friend, channelId: string) {
        setTabs((current) => current.some((tab) => tab.key === channelId)
            ? current
            : [...current, { key: channelId, kind: "dm", title: friend.displayName, friend }]);
    }

    function openChat(friend: Friend, channelId: string) {
        setChat({ channelId, friend });
        openDmTab(friend, channelId);
        setSelectedGroup(null);
    }

    async function handleOpenFriend(friend: Friend) {
        try {
            const { data } = await api.post<{ channel: { id: string } }>("/channels/dm", { toUserId: friend.id });
            openChat(friend, data.channel.id);
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    function openGroup(group: { id: string; name: string; role: GroupRole }) {
        const key = `group:${group.id}`;
        setTabs((current) => current.some((tab) => tab.key === key)
            ? current
            : [...current, { key, kind: "group", title: group.name, groupId: group.id, role: group.role }]);
        setChat(null);
        setSelectedGroup(group);
    }

    // Aba ativa é derivada: a fonte única de verdade é o conteúdo central.
    function activeTabKey(): string | null {
        if (chat) return chat.channelId;
        if (selectedGroup) return `group:${selectedGroup.id}`;
        return null;
    }

    function activateTab(tab: ConversationTab) {
        if (tab.kind === "dm" && tab.friend) {
            // Aba DM reabre o chat no centro; conversa e histórico continuam salvos.
            openChat(tab.friend, tab.key);
        } else if (tab.kind === "group" && tab.groupId) {
            setSelectedGroup({ id: tab.groupId, name: tab.title, role: tab.role ?? "member" });
            setChat(null);
        }
    }

    function closeTab(key: string) {
        const index = tabs.findIndex((tab) => tab.key === key);
        if (index === -1) return;
        const closing = tabs[index];
        const activeKey = activeTabKey();
        const next = key === activeKey ? tabs[index + 1] ?? tabs[index - 1] : null;

        // Fecha apenas a aba: conversa e histórico permanecem no servidor.
        setTabs(tabs.filter((tab) => tab.key !== key));
        if (next) {
            activateTab(next);
        } else if (key === activeKey) {
            if (closing.kind === "dm") {
                setChat(null);
            } else {
                setSelectedGroup(null);
            }
        }
    }

    function handleJoinCall(call: ActiveCallEntry) {
        if (!call.isCurrent) joinGroupCall(call.callGroupId, call.concordeGroupId);

        if (call.kind === "group" && call.group) {
            openGroup({ id: call.group.id, name: call.group.name, role: call.group.role });
            return;
        }

        if (call.kind === "dm" && call.friend) {
            void handleOpenFriend(call.friend);
        }
    }

    function openCallChat(peer: { userId: string; displayName: string }) {
        let cancelled = false;

        api.post<{ channel: { id: string } }>("/channels/dm", { toUserId: peer.userId })
            .then(({ data }) => {
                if (cancelled) return;
                openChat({
                    id: peer.userId,
                    username: peer.displayName,
                    displayName: peer.displayName
                }, data.channel.id);
            }).catch(() => { })
        return () => {
            cancelled = true;
        };
    }

    useEffect(() => {
        if (joinedGroup) groupCallRef.current = true;
    }, [joinedGroup]);

    useEffect(() => {
        if (groupId) {
            if (groupCallRef.current) return;
            if (peers.length === 1) {
                const peer = {
                    userId: peers[0].userId,
                    displayName: peers[0].username
                };
                lastCallPeer.current = peer;
                return openCallChat(peer);
            } else if (outgoing.status === "dialing") {
                const peer = {
                    userId: outgoing.toUserId,
                    displayName: outgoing.toDisplayName
                };
                lastCallPeer.current = peer;
                return openCallChat(peer);
            } else {
                lastCallPeer.current = null;
            }
            return;
        }
        const peer = lastCallPeer.current;
        lastCallPeer.current = null;
        const wasGroup = groupCallRef.current;
        groupCallRef.current = false;

        if (wasGroup || !peer) return;

        return openCallChat(peer);

    }, [groupId, peers, outgoing]);

    // Chamada ativa: tela cheia quando nada aberto; abrindo chat/grupo, some da tela
    // (áudio continua por baixo) e volta quando o conteúdo é fechado.
    const callActive = groupId !== null;
    // Chamada do grupo selecionado fica integrada no próprio GroupPage.
    const groupCallSelected = Boolean(joinedGroup && selectedGroup && joinedGroup.concordeGroupId === selectedGroup.id);

    function peerTitle(): string {
        if (outgoing.status === "dialing" && peers.length === 0) return outgoing.toDisplayName;
        if (peers.length === 1) return peers[0].username;
        if (peers.length > 1) return `Chamada com ${peers.length} amigos`;
        return "Chamada";
    }

    return (
        <main className={styles.container}>
            <div className={styles.contentRow}>
                {chat ? (
                    <ChatView
                        channelId={chat.channelId}
                        friend={chat.friend}
                        onBack={() => setChat(null)}
                    />
                ) : selectedGroup ? (
                    <GroupPage
                        groupId={selectedGroup.id}
                        name={selectedGroup.name}
                        role={selectedGroup.role}
                        onBack={() => setSelectedGroup(null)}
                    />
                ) : callActive && !groupCallSelected ? (
                    <CallScreen
                        layout="full"
                        flat
                        peerName={peerTitle()}
                    />
                ) : (
                    <Home />
                )}
                <GlobalRemoteAudio />
                {sidebarOpen && (
                    <SideBar
                        activeFriendId={chat?.friend.id ?? null}
                        onOpenFriend={handleOpenFriend}
                        onOpenGroup={openGroup}
                        onJoinCall={handleJoinCall}
                        onGroupDeleted={(groupIdArg) => {
                            setTabs((current) => current.filter((tab) => tab.key !== `group:${groupIdArg}`));
                            if (selectedGroup?.id === groupIdArg) setSelectedGroup(null);
                        }}
                    />
                )}
                <button
                    type="button"
                    className={styles.cornerBtn}
                    title={sidebarOpen ? "Esconder painel de conversas" : "Mostrar painel de conversas"}
                    aria-label={sidebarOpen ? "Esconder painel de conversas" : "Mostrar painel de conversas"}
                    onClick={toggleSidebar}
                >
                    <Users size={16} />
                </button>
            </div>
            <UserDock
                tabs={tabs}
                activeTabKey={activeTabKey()}
                onActivateTab={activateTab}
                onCloseTab={closeTab}
            />
        </main>
    )
}
