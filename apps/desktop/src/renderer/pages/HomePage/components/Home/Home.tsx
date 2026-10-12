import { useState } from "react";
import { MessageSquare, Plus, Users, UsersRound } from "lucide-react";

import type { CreateGroupInput } from "@concorde/shared";
import { useActiveCall } from "../../../../contexts/ActiveCallProvider";
import { useAuth } from "../../../../contexts/AuthContext";

import { api, getErrorMessage } from "../../../../api/api";
import { useChannels } from "../../../../hooks/useChannels";
import { useFriendsList } from "../../../../hooks/useFriendsList";
import { useGroupsList } from "../../../../hooks/useGroupsList";

import styles from "./Home.module.css";

const roleLabels: Record<string, string> = {
    owner: "Dono",
    admin: "Admin",
    member: "Membro",
};

export default function Home() {
    const { user } = useAuth();
    const [groupId, setGroupId] = useState("");
    const { join } = useActiveCall();
    const { groups, loading: loadingGroups, error: errorGroups, load: reloadGroups } = useGroupsList();
    const { friends, loading: loadingFriends, error: errorFriends } = useFriendsList();
    const { channels } = useChannels();
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const dmCount = channels.filter((channel) => channel.kind === "dm").length;

    async function handleCreate() {
        try {
            setError(null);
            if (!name.trim()) return;

            await api.post("/groups", { name: name.trim() } satisfies CreateGroupInput);
            setName("");
            await reloadGroups();
        } catch (error) {
            setError(getErrorMessage(error));
        }
    }

    return (
        <section className={styles.container}>
            <div className={styles.content}>
                <header className={styles.header}>
                    <h1 className={styles.headerTitle}>Olá, {user?.displayName}</h1>
                    <p className={styles.headerSubtitle}>Pronto para conversar?</p>
                </header>

                <div className={styles.stats}>
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
                        {error && (
                            <p>{error}</p>
                        )}
                    </div>
                </div>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Seus grupos</h2>
                    {loadingGroups && <p className={styles.empty}>Carregando...</p>}
                    {!loadingGroups && errorGroups && <p className={styles.empty}>{errorGroups}</p>}
                    {!loadingGroups && !errorGroups && groups.length === 0 && (
                        <p className={styles.empty}>Você ainda não está em nenhum grupo. Crie um acima.</p>
                    )}
                    {!loadingGroups && !errorGroups && groups.map((group) => (
                        <div key={group.id} className={styles.listRow}>
                            <span className={styles.listAvatar} aria-hidden="true">
                                {group.name.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                            <span className={styles.listName}>{group.name}</span>
                            <span className={styles.roleBadge}>{roleLabels[group.role] ?? group.role}</span>
                        </div>
                    ))}
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Amigos</h2>
                    {loadingFriends && <p className={styles.empty}>Carregando...</p>}
                    {!loadingFriends && errorFriends && <p className={styles.empty}>{errorFriends}</p>}
                    {!loadingFriends && !errorFriends && friends.length === 0 && (
                        <p className={styles.empty}>Adicione amigos pela aba Amigos para vê-los aqui.</p>
                    )}
                    {!loadingFriends && !errorFriends && friends.map((friend) => (
                        <div key={friend.id} className={styles.listRow}>
                            <span className={styles.listAvatar} aria-hidden="true">
                                {friend.displayName.trim().charAt(0).toUpperCase() || "?"}
                            </span>
                            <div className={styles.listText}>
                                <span className={styles.listName}>{friend.displayName}</span>
                                <span className={styles.listSub}>@{friend.username}</span>
                            </div>
                        </div>
                    ))}
                </section>

            </div>
        </section>
    )
}