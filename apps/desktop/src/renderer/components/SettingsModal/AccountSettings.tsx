import { useState } from "react";
import { BadgeCheck, Check, Clock, Eye, EyeOff, KeyRound, Lock, LogOut, Pencil, ShieldCheck } from "lucide-react";

import type { User } from "@concorde/shared";

import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastProvider";
import { api, getErrorMessage } from "../../api/api";

import styles from "./SettingsModal.module.css";

const MAX_DISPLAY_NAME_LENGTH = 32;

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString("pt-BR");
}

export default function AccountSettings() {
    const { user, updateUser, logout } = useAuth();
    const { push } = useToast();

    const [name, setName] = useState(user?.displayName ?? "");
    const [nameBusy, setNameBusy] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNext, setShowNext] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [passwordBusy, setPasswordBusy] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const initial = (user?.displayName ?? "?").trim().charAt(0).toUpperCase();
    const nameDirty = name.trim().length > 0 && name.trim() !== (user?.displayName ?? "").trim();

    async function saveDisplayName() {
        if (!nameDirty || nameBusy) return;

        setNameBusy(true);
        setNameError(null);

        try {
            const { data } = await api.patch<User>("/auth/me", { displayName: name.trim() });
            updateUser(data);
            setName(data.displayName);
            push("Nome atualizado.", "success");
        } catch (error) {
            setNameError(getErrorMessage(error) ?? "Não foi possível atualizar o nome.");
        } finally {
            setNameBusy(false);
        }
    }

    async function savePassword() {
        if (passwordBusy) return;

        if (newPassword.length < 6) {
            setPasswordError("A nova senha precisa de pelo menos 6 caracteres.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("A confirmação não confere com a nova senha.");
            return;
        }

        setPasswordBusy(true);
        setPasswordError(null);

        try {
            await api.post("/auth/me/password", { currentPassword, newPassword });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setShowCurrent(false);
            setShowNext(false);
            setShowConfirm(false);
            push("Senha atualizada.", "success");
        } catch (error) {
            setPasswordError(getErrorMessage(error) ?? "Não foi possível atualizar a senha.");
        } finally {
            setPasswordBusy(false);
        }
    }

    function passwordEye(show: boolean, toggle: () => void, label: string) {
        return (
            <button
                type="button"
                className={styles.fieldEye}
                aria-label={label}
                onClick={toggle}
            >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
        );
    }

    return (
        <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Conta</h3>
            <p className={styles.panelDesc}>Suas informações neste dispositivo.</p>

            <div className={styles.panelStack}>
                <div className={styles.profileCard}>
                    <div className={styles.banner} aria-hidden="true" />

                    <div className={styles.avatarWrap}>
                        <span className={styles.avatarBig} aria-hidden="true">{initial}</span>
                    </div>

                    <div className={styles.identityBody}>
                        <div className={styles.identityHead}>
                            <p className={styles.identityName}>{user?.displayName}</p>
                            <p className={styles.identityHandle}>@{user?.username}</p>
                        </div>

                        <div className={styles.divider} />

                        <form onSubmit={(event) => { event.preventDefault(); void saveDisplayName(); }}>
                            <div className={styles.formStack}>
                                <label className={styles.fieldLabel} htmlFor="displayNameInput">Nome de exibição</label>
                                <div className={styles.fieldWrap}>
                                    <span className={styles.fieldIcon}><Pencil size={14} /></span>
                                    <input
                                        id="displayNameInput"
                                        className={styles.fieldInput}
                                        value={name}
                                        maxLength={MAX_DISPLAY_NAME_LENGTH}
                                        placeholder={user?.displayName}
                                        onChange={(event) => { setName(event.target.value); setNameError(null); }}
                                    />
                                </div>
                                {nameError && (
                                    <p className={styles.errorChip}>
                                        <ShieldCheck size={13} />
                                        {nameError}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    className={styles.actionBtn}
                                    disabled={!nameDirty || nameBusy}
                                >
                                    <Check size={15} />
                                    {nameBusy ? "Salvando..." : "Salvar nome"}
                                </button>
                            </div>
                        </form>

                        <div className={styles.divider} />

                        <div className={styles.sinceRow}>
                            <Clock size={14} />
                            <span>Membro desde</span>
                            <b className={styles.sinceDate}>{user?.createdAt ? formatDate(user.createdAt) : "-- / -- / ----"}</b>
                            <BadgeCheck size={14} className={styles.sinceBadge} />
                        </div>
                    </div>
                </div>

                <div className={styles.sectionCard}>
                    <div className={styles.sectionHead}>
                        <span className={`${styles.sectionIcon} ${styles.sectionIconAlt}`} aria-hidden="true">
                            <KeyRound size={16} />
                        </span>
                        <div className={styles.sectionHeadText}>
                            <p className={styles.sectionTitle}>Senha</p>
                            <p className={styles.sectionHint}>Troque de vez em quando. Mínimo de 6 caracteres.</p>
                        </div>
                    </div>

                    <form onSubmit={(event) => { event.preventDefault(); void savePassword(); }}>
                        <div className={styles.formStack}>
                            <label className={styles.fieldLabel} htmlFor="currentPasswordInput">Senha atual</label>
                            <div className={styles.fieldWrap}>
                                <span className={styles.fieldIcon}><Lock size={15} /></span>
                                <input
                                    id="currentPasswordInput"
                                    className={styles.fieldInput}
                                    type={showCurrent ? "text" : "password"}
                                    value={currentPassword}
                                    placeholder="Sua senha atual"
                                    autoComplete="current-password"
                                    onChange={(event) => { setCurrentPassword(event.target.value); setPasswordError(null); }}
                                />
                                {passwordEye(showCurrent, () => setShowCurrent((v) => !v), "Mostrar ou ocultar senha atual")}
                            </div>

                            <label className={styles.fieldLabel} htmlFor="newPasswordInput">Nova senha</label>
                            <div className={styles.fieldWrap}>
                                <span className={styles.fieldIcon}><KeyRound size={15} /></span>
                                <input
                                    id="newPasswordInput"
                                    className={styles.fieldInput}
                                    type={showNext ? "text" : "password"}
                                    value={newPassword}
                                    placeholder="Pelo menos 6 caracteres"
                                    autoComplete="new-password"
                                    onChange={(event) => { setNewPassword(event.target.value); setPasswordError(null); }}
                                />
                                {passwordEye(showNext, () => setShowNext((v) => !v), "Mostrar ou ocultar nova senha")}
                            </div>

                            <label className={styles.fieldLabel} htmlFor="confirmPasswordInput">Confirmar nova senha</label>
                            <div className={styles.fieldWrap}>
                                <span className={styles.fieldIcon}><KeyRound size={15} /></span>
                                <input
                                    id="confirmPasswordInput"
                                    className={styles.fieldInput}
                                    type={showConfirm ? "text" : "password"}
                                    value={confirmPassword}
                                    placeholder="Repita a nova senha"
                                    autoComplete="new-password"
                                    onChange={(event) => { setConfirmPassword(event.target.value); setPasswordError(null); }}
                                />
                                {passwordEye(showConfirm, () => setShowConfirm((v) => !v), "Mostrar ou ocultar confirmação")}
                            </div>

                            {passwordError && (
                                <p className={styles.errorChip}>
                                    <ShieldCheck size={13} />
                                    {passwordError}
                                </p>
                            )}

                            <button
                                type="submit"
                                className={styles.actionBtn}
                                disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
                            >
                                <Check size={15} />
                                {passwordBusy ? "Salvando..." : "Salvar nova senha"}
                            </button>
                        </div>
                    </form>
                </div>

                <button type="button" className={styles.dangerBtn} onClick={logout}>
                    <LogOut size={15} />
                    Sair da conta
                </button>
            </div>
        </section>
    );
}
