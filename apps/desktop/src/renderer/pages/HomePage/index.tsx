import { useEffect, useRef, useState } from "react"

import CallScreen from "../../components/CallScreen/CallScreen";
import DirectChat from "../../components/CallScreen/DirectChat";
import SideBar from "../../components/SideBar/SideBar"
import Friends from './components/Friends/Friends';
import Home from './components/Home/Home';
import type { Friend } from "@concorde/shared";
import { useActiveCall } from "../../contexts/ActiveCallProvider";
import { useCallInviteState } from "../../contexts/CallInviteProvider";

import { api } from "../../api/api";
import { GlobalRemoteAudio } from '../../hooks/GlobalRemoteAudio';

import styles from "./HomePage.module.css"

export type SectionType = "home" | "friends" | "room";

export default function HomePage() {
    const [Section, setSection] = useState<SectionType>("home");
    const { groupId, peers } = useActiveCall();
    const { outgoing } = useCallInviteState();
    const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [chatOpen, setChatOpen] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const previousSection = useRef<Exclude<SectionType, "room">>("home");
    const lastCallPeer = useRef<{ userId: string; displayName: string } | null>(null);

    useEffect(() => {
        if (groupId) {
            if (peers.length === 1) {
                lastCallPeer.current = {
                    userId: peers[0].userId,
                    displayName: peers[0].username
                }
            } else if (outgoing.status === "dialing") {
                lastCallPeer.current = {
                    userId: outgoing.toUserId,
                    displayName: outgoing.toDisplayName
                }
            } else {
                lastCallPeer.current = null;
            }
            return;
        }
        const peer = lastCallPeer.current;
        lastCallPeer.current = null;

        if (!peer) return;

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

    }, [groupId, peers, outgoing]);

    useEffect(() => {
        if (groupId) {
            setSection((current) => {
                if (current !== "room") {
                    previousSection.current = current;
                }
                return "room";
            });
        } else {
            setSection(previousSection.current);
        }
    }, [groupId]);

    return (
        <main className={styles.container}>
            {(sidebarOpen || Section !== "room") && <SideBar section={Section} setSection={setSection} />}
            {Section === "home" && <Home />}
            {Section === "friends" && <Friends activeChannelId={activeChannelId} onActiveChannel={setActiveChannelId} onSelectFriend={setSelectedFriend} selectedFriend={selectedFriend} />}
            {Section === "room" && groupId && (
                <div className={styles.callLayout}>
                    <CallScreen
                        layout="full"
                        chatAvailable={peers.length === 1 || outgoing.status === "dialing"}
                        chatOpen={chatOpen}
                        onToggleChat={() => setChatOpen((open) => !open)}
                        sidebarOpen={sidebarOpen}
                        onToggleSidebar={() => setSidebarOpen((open) => !open)}
                    />
                    {chatOpen && (peers.length === 1 ? (
                        <div className={styles.callChat}>
                            <DirectChat
                                userId={peers[0].userId}
                                displayName={peers[0].username}
                            />
                        </div>
                    ) : outgoing.status === "dialing" ? (
                        <div className={styles.callChat}>
                            <DirectChat
                                userId={outgoing.toUserId}
                                displayName={outgoing.toDisplayName}
                            />
                        </div>
                    ) : null)}
                </div>
            )}
            <GlobalRemoteAudio />
        </main>
    )
}