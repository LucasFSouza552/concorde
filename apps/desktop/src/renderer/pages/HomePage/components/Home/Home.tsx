import { useState } from "react";
import { Plus } from "lucide-react";

import type { CreateGroupInput } from "@concorde/shared";
import { useActiveCall } from "../../../../contexts/ActiveCallProvider";
import { useAuth } from "../../../../contexts/AuthContext";

import { api, getErrorMessage } from "../../../../api/api";
import { useGroupsList } from "../../../../hooks/useGroupsList";

import styles from "./Home.module.css";

export default function Home() {
    const { user } = useAuth();
    const [groupId, setGroupId] = useState("");
    const { join } = useActiveCall();
    const { groups, loading, error: errorGroups, load: reloadGroups } = useGroupsList();
    const [name, setName] = useState("teste1");
    const [error, setError] = useState<string | null>(null);

    async function handleCreate() {
        try {
            setError(null);
            if (!name.trim()) return;

            await api.post("/groups", { name: name } satisfies CreateGroupInput);
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

                <div className={styles.actions}>
                    <button className={styles.createCard} onClick={handleCreate}>
                        <Plus size={22} aria-hidden="true" className={styles.createCardIcon} />
                        <span className={styles.createCardText}>
                            <strong className={styles.createCardTitle}>Criar um grupo</strong>
                            Comece uma conversa agora
                        </span>
                    </button>

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
                    <h2 className={styles.sectionTitle}>Grupos ativos</h2>
                    {loading && <p className={styles.empty}>Carregando...</p>}
                    {!loading && errorGroups && <p className={styles.empty}>{errorGroups}</p>}
                    {!loading && !errorGroups && groups.length === 0 && (
                        <p className={styles.empty}>Nenhum grupo ativo no momento.</p>
                    )}
                    {!loading && !errorGroups && groups.map((group) => (
                        <div key={group.id}>{group.name}</div>
                    ))}
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Amigos online</h2>
                    <p className={styles.empty}>Nenhum amigo online.</p>
                </section>

            </div>
        </section>
    )
}