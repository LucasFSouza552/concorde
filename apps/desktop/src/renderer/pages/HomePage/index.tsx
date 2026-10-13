import { useEffect, useRef, useState } from "react"
import { PanelLeftOpen } from "lucide-react";

import SideBar from "../../components/SideBar/SideBar"
import Friends from './components/Friends/Friends';
import Home from './components/Home/Home';
import type { Friend } from "@concorde/shared";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useCallInviteState } from "../../contexts/CallInviteProvider";

import { api } from "../../api/api";
import { GlobalRemoteAudio } from '../../hooks/GlobalRemoteAudio';

import styles from "./HomePage.module.css";

export type SectionType = "home" | "friends";

export default function HomePage() {
    const [Section, setSection] = useState<SectionType>("home");
    const { groupId, peers } = useActiveCall();
    const { outgoing } = useCallInviteState();
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const lastCallPeer = useRef<{ userId: string; displayName: string } | null>(null);

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
        if (groupId) {
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

        if (!peer) return;

        return openDirectMessage(peer);

    }, [groupId, peers, outgoing]);

    return (
        <main className={styles.container}>
            {sidebarOpen && <SideBar section={Section} setSection={setSection} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />}
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
            <Home hidden={Section !== "home"} />
            <Friends hidden={Section !== "friends"} activeChannelId={activeChannelId} onActiveChannel={setActiveChannelId} onSelectFriend={setSelectedFriend} selectedFriend={selectedFriend} />
            <GlobalRemoteAudio />
        </main>
    )
}