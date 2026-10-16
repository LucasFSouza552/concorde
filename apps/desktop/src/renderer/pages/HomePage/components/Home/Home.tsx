import { useState } from "react";
import { BellRing, ChevronRight, MessageSquare, Phone, Plus, UserPlus, Users, UsersRound } from "lucide-react";

import InlineError from "../../../../components/InlineError/InlineError";
import Page from "../../../../components/Page/Page";
import Section from "../../../../components/Section/Section";
import { roleLabels, type CreateGroupInput, type Friend, type GroupRole } from "@concorde/shared";
import { useActiveCall } from "../../../../contexts/ActiveCallProvider";
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from "../../../../contexts/ToastProvider";

import { api, getErrorMessage } from "../../../../api/api";
import { useChannels } from "../../../../hooks/useChannels";
import { useFriendsList } from "../../../../hooks/useFriendsList";
import { useGroupsList } from "../../../../hooks/useGroupsList";
import { useIncomingRequests } from "../../../../hooks/useIncomingRequests";

import styles from "./Home.module.css";

function greetingFor(date: Date): string {
    const hour = date.getHours();
    if (hour < 6) return "Boa madrugada";
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

interface HomeProps {
    hidden?: boolean;
    onOpenFriend: (friend: Friend) => void;
    onGoFriends: () => void;
    onSelectGroup: (group: { id: string; name: string; role: GroupRole }) => void;
}

export default function Home({ hidden = false, onOpenFriend, onGoFriends, onSelectGroup }: HomeProps) {
    const { user } = useAuth();
    const [groupId, setGroupId] = useState("");
    const { join } = useActiveCall();
    const { groups, loading: loadingGroups, error: errorGroups, load: reloadGroups } = useGroupsList();
    const { friends, loading: loadingFriends, error: errorFriends, load: reloadFriends } = useFriendsList();
    const { channels } = useChannels();
    const { requests } = useIncomingRequests();
    const [name, setName] = useState("");

    const { push } = useToast();

    const now = new Date();
    const dateLine = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const dmCount = channels.filter((channel) => channel.kind === "dm").length;
    const initial = (user?.displayName ?? "?").trim().charAt(0).toUpperCase() || "?";

    async function handleCreate() {
        try {
            if (!name.trim()) return;

            await api.post("/groups", { name: name.trim() } satisfies CreateGroupInput);
            setName("");
            await reloadGroups();
        } catch (error) {
            push(getErrorMessage(error), "error");
        }
    }

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
                        <p className={styles.headerSubtitle}>
                            {friends.length} {friends.length === 1 ? "amigo" : "amigos"} · {groups.length} {groups.length === 1 ? "grupo" : "grupos"} · {dmCount} {dmCount === 1 ? "conversa" : "conversas"}
                        </p>
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

                {friends.length === 0 && groups.length === 0 && !loadingFriends && !loadingGroups && (
                    <div className={styles.onboarding}>
                        <strong className={styles.onboardingTitle}>Comece por aqui</strong>
                        <ol className={styles.onboardingSteps}>
                            <li>
                                <UserPlus size={16} aria-hidden="true" />
                                <div>
                                    <span>Adicione amigos pelo nome de usuário</span>
                                    <button type="button" className={styles.seeAllBtn} onClick={onGoFriends}>
                                        Ir para Amigos
                                    </button>
                                </div>
                            </li>
                            <li>
                                <UsersRound size={16} aria-hidden="true" />
                                <div>
                                    <span>Crie um grupo e chame o pessoal</span>
                                </div>
                            </li>
                            <li>
                                <Phone size={16} aria-hidden="true" />
                                <div>
                                    <span>Ligue direto da conversa ou da lista</span>
                                </div>
                            </li>
                        </ol>
                    </div>
                )}

                <div className={styles.actions}>
                    <div className={styles.createCard}>
                        <Plus size={22} aria-hidden="true" className={styles.createCardIcon} />
                        <div className={styles.createForm}>
                            <strong className={styles.createCardTitle}>Criar um grupo</strong>
                            <div className={styles.joinRow}>
                                <input
                                    className={styles.joinField}
                                    placeholder="Nome do grupo"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") void handleCreate();
                                    }}
                                />
                                <button className={styles.joinBtn} onClick={handleCreate}>Criar</button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.joinCard}>
                        <label className={styles.joinLabel} htmlFor="invite">entrar com código</label>
                        <div className={styles.joinRow}>
                            <input className={styles.joinField} id="invite" placeholder="código de convite" value={groupId} onChange={(e) => setGroupId(e.target.value)} />
                            <button className={styles.joinBtn} onClick={() => join(groupId)}>Entrar</button>
                        </div>
                    </div>
                </div>

                <div className={styles.columns}>
                    <Section title="Conversas">
                        {loadingFriends && <p className={styles.empty}>Carregando...</p>}
                        {!loadingFriends && errorFriends && <InlineError message={errorFriends} onRetry={reloadFriends} />}
                        {!loadingFriends && !errorFriends && friends.length === 0 && (
                            <p className={styles.empty}>Adicione amigos para começar a conversar.</p>
                        )}
                        {!loadingFriends && !errorFriends && friends.slice(0, 8).map((friend) => (
                            <button
                                key={friend.id}
                                type="button"
                                className={styles.listRowAction}
                                onClick={() => onOpenFriend(friend)}
                                title={`Conversar com ${friend.displayName}`}
                            >
                                <span className={styles.listAvatar} aria-hidden="true">
                                    {friend.displayName.trim().charAt(0).toUpperCase() || "?"}
                                </span>
                                <div className={styles.listText}>
                                    <span className={styles.listName}>{friend.displayName}</span>
                                    <span className={styles.listSub}>@{friend.username}</span>
                                </div>
                                <ChevronRight size={16} aria-hidden="true" className={styles.rowChevron} />
                            </button>
                        ))}
                        {!loadingFriends && !errorFriends && friends.length > 8 && (
                            <button type="button" className={styles.seeAllBtn} onClick={onGoFriends}>
                                Ver todos os {friends.length} amigos
                            </button>
                        )}
                    </Section>

                    <Section title="Seus grupos">
                        {loadingGroups && <p className={styles.empty}>Carregando...</p>}
                        {!loadingGroups && errorGroups && <InlineError message={errorGroups} onRetry={reloadGroups} />}
                        {!loadingGroups && !errorGroups && groups.length === 0 && (
                            <p className={styles.empty}>Você ainda não está em nenhum grupo. Crie um acima.</p>
                        )}
                        {!loadingGroups && !errorGroups && groups.map((group) => (
                            <button
                                key={group.id}
                                type="button"
                                className={styles.listRowAction}
                                onClick={() => onSelectGroup({ id: group.id, name: group.name, role: group.role })}
                                title={`Abrir ${group.name}`}
                            >
                                <span className={styles.listAvatar} aria-hidden="true">
                                    {group.name.trim().charAt(0).toUpperCase() || "?"}
                                </span>
                                <span className={styles.listName}>{group.name}</span>
                                <span className={styles.roleBadge}>{roleLabels[group.role] ?? group.role}</span>
                                <ChevronRight size={16} aria-hidden="true" className={styles.rowChevron} />
                            </button>
                        ))}
                    </Section>
                </div>

            </div>
        </Page>
    )
}