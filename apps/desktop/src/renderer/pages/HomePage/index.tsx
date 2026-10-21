import { useEffect, useRef, useState } from "react"
import { PanelLeftOpen } from "lucide-react";

import SideBar from "../../components/SideBar/SideBar"
import Friends from './components/Friends/Friends';
import GroupPage from "./components/Home/GroupPage";
import Home from './components/Home/Home';
import type { Friend, GroupRole } from "@concorde/shared";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useCallInviteState } from "../../contexts/CallInviteProvider";
import { useToast } from "../../contexts/ToastProvider";

import { api, getErrorMessage } from "../../api/api";
import { GlobalRemoteAudio } from '../../hooks/GlobalRemoteAudio';
import type { ActiveCallEntry } from "../../hooks/useActiveCalls";

import styles from "./HomePage.module.css";

export type SectionType = "home" | "friends" | "group";

export default function HomePage() {
    const [Section, setSection] = useState<SectionType>("home");
    const { groupId, peers } = useActiveCall();
    const { outgoing, joinedGroup, joinGroupCall } = useCallInviteState();
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<{ id: string; name: string; role: GroupRole } | null>(null);
    const lastCallPeer = useRef<{ userId: string; displayName: string } | null>(null);
    const groupCallRef = useRef(false);
    const { push } = useToast();

    async function handleOpenFriend(friend: Friend) {
        try {
            const { data } = await api.post<{ channel: { id: string } }>("/channels/dm", { toUserId: friend.id });
            setSelectedFriend(friend);
            setActiveChannelId(data.channel.id);
            setSection("friends");
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

    function goFriends() {
        setActiveChannelId(null);
        setSelectedFriend(null);
        setSection("friends");
    }

    function handleJoinCall(call: ActiveCallEntry) {
        if (!call.isCurrent) joinGroupCall(call.callGroupId, call.concordeGroupId);

        if (call.kind === "group" && call.group) {
            setSelectedGroup({ id: call.group.id, name: call.group.name, role: call.group.role });
            setSection("group");
            return;
        }

        if (call.kind === "dm" && call.friend) {
            void handleOpenFriend(call.friend);
        }
    }

    function openDirectMessage(peer: { userId: string; displayName: string }) {
        let cancelled = false;

        api.post<{ channel: { id: string } }>("/channels/dm", { toUserId: peer.userId })
            .then(({ data }) => {
                if (cancelled) return;
                setActiveChannelId(data.channel.id);
                setSelectedFriend({
                    id: peer.userId,
                    username: peer.displayName,
                    displayName: peer.displayName
                });
                setSection("friends");
            }).catch(() => {

            })
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
                return openDirectMessage(peer);
            } else if (outgoing.status === "dialing") {
                const peer = {
                    userId: outgoing.toUserId,
                    displayName: outgoing.toDisplayName
                };
                lastCallPeer.current = peer;
                return openDirectMessage(peer);
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

        return openDirectMessage(peer);

    }, [groupId, peers, outgoing]);

    return (
        <main className={styles.container}>
            {sidebarOpen && (
                <SideBar
                    section={Section}
                    setSection={setSection}
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={() => setSidebarOpen((open) => !open)}
                    selectedGroupId={selectedGroup?.id ?? null}
                    onSelectGroup={(group) => {
                        setSelectedGroup(group);
                        setSection("group");
                    }}
                    onJoinCall={handleJoinCall}
                    onGoFriends={goFriends}
                    onOpenFriend={handleOpenFriend}
                    onGroupDeleted={(groupId) => {
                        if (selectedGroup?.id === groupId) {
                            setSelectedGroup(null);
                            setSection("home");
                        }
                    }}
                />
            )}
            {!sidebarOpen && (
                <button
                    type="button"
                    className={styles.expandBtn}
                    aria-label="Mostrar barra lateral"
                    title="Mostrar barra lateral"
                    onClick={() => setSidebarOpen(true)}
                >
                    <PanelLeftOpen size={14} />
                </button>
            )}
            <Home
                hidden={Section !== "home"}
                onOpenFriend={handleOpenFriend}
                onGoFriends={goFriends}
                onJoinCall={handleJoinCall}
            />
            <Friends hidden={Section !== "friends"} activeChannelId={activeChannelId} onActiveChannel={setActiveChannelId} onSelectFriend={setSelectedFriend} selectedFriend={selectedFriend} />
            {Section === "group" && selectedGroup && (
                <GroupPage
                    groupId={selectedGroup.id}
                    name={selectedGroup.name}
                    role={selectedGroup.role}
                    onBack={() => {
                        setSelectedGroup(null);
                        setSection("home");
                    }}
                />
            )}
            <GlobalRemoteAudio />
        </main>
    )
}