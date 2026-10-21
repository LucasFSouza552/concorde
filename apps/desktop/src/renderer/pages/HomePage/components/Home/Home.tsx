import { useMemo, useState } from "react";
import { BellRing, ChevronRight, MessageSquare, Phone, Users, UsersRound } from "lucide-react";

import InlineError from "../../../../components/InlineError/InlineError";
import Page from "../../../../components/Page/Page";
import Section from "../../../../components/Section/Section";
import type { Friend } from "@concorde/shared";
import AddFriendModal from "./AddFriendModal";
import CreateGroupModal from "./CreateGroupModal";
import HomeActions from "./HomeActions";
import QuickCallModal from "./QuickCallModal";
import { useAuth } from "../../../../contexts/AuthContext";
import { useCallInviteState } from "../../../../contexts/CallInviteProvider";

import { useActiveCalls, type ActiveCallEntry } from "../../../../hooks/useActiveCalls";
import { useChannels } from "../../../../hooks/useChannels";
import { useFriendsList } from "../../../../hooks/useFriendsList";
import { useFriendsPresence } from "../../../../hooks/useFriendsPresence";
import { useGroupsList } from "../../../../hooks/useGroupsList";
import { useIncomingRequests } from "../../../../hooks/useIncomingRequests";
import { STATUS_COLOR, STATUS_GLOW, STATUS_LABEL } from "../../../../utils/status";

import styles from "./Home.module.css";

type HomeModal = "addFriend" | "quickCall" | "createGroup" | null;

function greetingFor(date: Date): string {
    const hour = date.getHours();
    if (hour < 6) return "Boa madrugada";
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

function initialOf(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "?";
}

interface HomeProps {
    hidden?: boolean;
    onOpenFriend: (friend: Friend) => void;
    onGoFriends: () => void;
    onJoinCall: (call: ActiveCallEntry) => void;
}

export default function Home({ hidden = false, onOpenFriend, onGoFriends, onJoinCall }: HomeProps) {
    const { user } = useAuth();
    const { dial } = useCallInviteState();
    const { groups, loading: loadingGroups, load: reloadGroups } = useGroupsList();
    const { friends, loading: loadingFriends, error: errorFriends, load: reloadFriends } = useFriendsList();
    const { channels } = useChannels();
    const { requests } = useIncomingRequests();
    const [modal, setModal] = useState<HomeModal>(null);

    const presences = useFriendsPresence(friends);
    const { calls } = useActiveCalls(groups, friends);

    const now = new Date();
    const dateLine = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const dmCount = channels.filter((channel) => channel.kind === "dm").length;
    const initial = initialOf(user?.displayName ?? "?");

    const onlineFriends = useMemo(() => friends
        .filter((friend) => {
            const status = presences.get(friend.id)?.status;
            return status !== undefined && status !== "offline";
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
        [friends, presences],
    );

    const groupCalls = useMemo(() => calls.filter((call) => call.kind === "group"), [calls]);

    return (
        <Page hidden={hidden}>
            <div className={styles.content}>
                <header className={styles.hero}>
                    <span className={styles.heroAvatar} aria-hidden="true">
                        {initial}
                    </span>
                    <div className={styles.heroText}>
                        <p className={styles.heroDate}>{dateLine}</p>
                        <h1 className={styles.headerTitle}>{greetingFor(now)}, {user?.displayName}</h1>
                    </div>
                    <div className={styles.heroStats}>
                        <div className={styles.statCard}>
                            <Users size={18} aria-hidden="true" className={styles.statIcon} />
                            <div>
                                <strong className={styles.statNumber}>{friends.length}</strong>
                                <span className={styles.statLabel}>{friends.length === 1 ? "amigo" : "amigos"}</span>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <UsersRound size={18} aria-hidden="true" className={styles.statIcon} />
                            <div>
                                <strong className={styles.statNumber}>{groups.length}</strong>
                                <span className={styles.statLabel}>{groups.length === 1 ? "grupo" : "grupos"}</span>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <MessageSquare size={18} aria-hidden="true" className={styles.statIcon} />
                            <div>
                                <strong className={styles.statNumber}>{dmCount}</strong>
                                <span className={styles.statLabel}>{dmCount === 1 ? "conversa" : "conversas"}</span>
                            </div>
                        </div>
                    </div>
                </header>

                {requests.length > 0 && (
                    <button type="button" className={styles.pendingBanner} onClick={onGoFriends}>
                        <BellRing size={18} aria-hidden="true" />
                        <span>
                            <strong>{requests.length} {requests.length === 1 ? "pedido pendente" : "pedidos pendentes"}</strong>
                            <small>Toque para responder</small>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" />
                    </button>
                )}

                <HomeActions
                    onAddFriend={() => setModal("addFriend")}
                    onQuickCall={() => setModal("quickCall")}
                    onCreateGroup={() => setModal("createGroup")}
                />

                <div className={styles.columns}>
                    <Section
                        title="Amigos Online"
                        action={<button type="button" className={styles.seeAllBtn} onClick={onGoFriends}>Ver Todos</button>}
                    >
                        {loadingFriends && <p className={styles.empty}>Carregando...</p>}
                        {!loadingFriends && errorFriends && <InlineError message={errorFriends} onRetry={reloadFriends} />}
                        {!loadingFriends && !errorFriends && onlineFriends.length === 0 && (
                            <p className={styles.empty}>Nenhum amigo online agora.</p>
                        )}
                        {onlineFriends.slice(0, 8).map((friend) => {
                            const status = presences.get(friend.id)?.status ?? "offline";

                            return (
                                <div key={friend.id} className={styles.friendRow}>
                                    <div className={styles.friendRowArea}>
                                        <span className={styles.listAvatar} aria-hidden="true">
                                            {initialOf(friend.displayName)}
                                        </span>
                                        <div className={styles.listText}>
                                            <span className={styles.listName}>{friend.displayName}</span>
                                            <span className={styles.listSub}>
                                                <span
                                                    className={styles.statusDot}
                                                    aria-hidden="true"
                                                    style={{
                                                        background: STATUS_COLOR[status],
                                                        boxShadow: STATUS_GLOW[status],
                                                    }}
                                                />
                                                {STATUS_LABEL[status]} · @{friend.username}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.friendRowArea}>
                                        <button
                                            type="button"
                                            className={styles.rowIconBtn}
                                            title={`Mensagem para ${friend.displayName}`}
                                            aria-label={`Mensagem para ${friend.displayName}`}
                                            onClick={() => onOpenFriend(friend)}
                                        >
                                            <MessageSquare size={15} aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.rowIconBtn}
                                            title={`Ligar para ${friend.displayName}`}
                                            aria-label={`Ligar para ${friend.displayName}`}
                                            onClick={() => void dial(friend)}
                                        >
                                            <Phone size={15} aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {onlineFriends.length > 8 && (
                            <button type="button" className={styles.seeAllBtn} onClick={onGoFriends}>
                                Ver todos os {onlineFriends.length} online
                            </button>
                        )}
                    </Section>

                    <Section
                        title="Grupos em Chamada"
                        action={
                            groupCalls.length > 0
                                ? <span className={styles.badge}>{groupCalls.length}</span>
                                : undefined
                        }
                    >
                        {loadingGroups && <p className={styles.empty}>Carregando...</p>}
                        {!loadingGroups && groupCalls.length === 0 && (
                            <p className={styles.empty}>Nenhuma chamada de grupo no momento.</p>
                        )}
                        {groupCalls.map((call) => {
                            const present = friends.filter((friend) => presences.get(friend.id)?.groupId === call.callGroupId);

                            return (
                                <div key={call.key} className={styles.callCard}>
                                    <div className={styles.callCardTop}>
                                        <span className={styles.listAvatar} aria-hidden="true">
                                            {initialOf(call.title)}
                                        </span>
                                        <div className={styles.listText}>
                                            <span className={styles.listName}>{call.title}</span>
                                            <span className={styles.listSub}>{call.subtitle}</span>
                                        </div>
                                        {present.length > 0 && (
                                            <div className={styles.avatarStack} aria-hidden="true">
                                                {present.slice(0, 4).map((friend) => (
                                                    <span key={friend.id} className={styles.stackAvatar}>
                                                        {initialOf(friend.displayName)}
                                                    </span>
                                                ))}
                                                {present.length > 4 && (
                                                    <span className={styles.stackAvatar}>+{present.length - 4}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className={call.isCurrent ? styles.callGroupBtnCurrent : styles.callGroupBtn}
                                        onClick={() => onJoinCall(call)}
                                    >
                                        {call.isCurrent ? "Voltar para a chamada" : "Entrar na Chamada"}
                                    </button>
                                </div>
                            );
                        })}
                    </Section>
                </div>
            </div>

            {modal === "addFriend" && <AddFriendModal onClose={() => setModal(null)} />}
            {modal === "quickCall" && <QuickCallModal friends={friends} onClose={() => setModal(null)} />}
            {modal === "createGroup" && (
                <CreateGroupModal onClose={() => setModal(null)} onCreated={() => void reloadGroups()} />
            )}

        </Page>
    )
}