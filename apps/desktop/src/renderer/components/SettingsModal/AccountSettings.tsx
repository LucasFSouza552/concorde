import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Check, Clock, Eye, EyeOff, ImagePlus, KeyRound, Lock, LogOut, Pencil, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

import type { User } from "@concorde/shared";

import DiscordIcon from "../DiscordIcon/DiscordIcon";
import { useAuth } from "../../contexts/AuthContext";
import { useDiscordOAuth } from "../../hooks/useDiscordOAuth";
import { useToast } from "../../contexts/ToastProvider";
import { api, getErrorMessage } from "../../api/api";
import UserAvatar from "../UserAvatar/UserAvatar";
import { fileToCompressedDataUrl } from "../../utils/image";

import styles from "./SettingsModal.module.css";

const MAX_DISPLAY_NAME_LENGTH = 32;

/** Valores do seletor quando o perfil não tem fundo definido (tema padrão). */
const DEFAULT_BANNER_FROM = "#5865f2";
const DEFAULT_BANNER_TO = "#8b5cf6";

function normalizeHexColor(value: string): string | null {
    const raw = value.trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
    if (/^[0-9a-f]{3}$/i.test(raw)) {
        return `#${raw.split("").map((char) => char + char).join("").toLowerCase()}`;
    }
    return null;
}

interface ColorFieldProps {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
}

function ColorField({ label, value, disabled = false, onChange }: ColorFieldProps) {
    const [draft, setDraft] = useState(value);
    const pickerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    useEffect(() => {
        const picker = pickerRef.current;
        if (!picker) return;

        picker.value = value;

        function handlePickerChange(event: Event) {
            const next = (event.currentTarget as HTMLInputElement).value.toLowerCase();
            if (next !== value) onChange(next);
        }

        picker.addEventListener("change", handlePickerChange);
        return () => picker.removeEventListener("change", handlePickerChange);
    }, [value, onChange]);

    function handleDraft(next: string) {
        setDraft(next);
        const normalized = normalizeHexColor(next);
        if (normalized) onChange(normalized);
    }

    return (
        <div className={styles.customizeGroup}>
            <span className={styles.customizeLabel}>{label}</span>
            <div className={styles.colorRow}>
                <input
                    ref={pickerRef}
                    type="color"
                    className={styles.colorInput}
                    defaultValue={value}
                    disabled={disabled}
                    title="Abrir seletor de cores"
                    aria-label={`${label}: seletor de cor`}
                />
                <input
                    type="text"
                    className={styles.hexInput}
                    value={draft}
                    disabled={disabled}
                    spellCheck={false}
                    maxLength={7}
                    aria-label={`${label}: código hexadecimal`}
                    onChange={(event) => handleDraft(event.target.value)}
                    onBlur={() => setDraft(value)}
                />
            </div>
        </div>
    );
}

function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString("pt-BR");
}

export default function AccountSettings() {
    const { user, updateUser, logout } = useAuth();
    const { requestSensitiveAction, busy: oauthBusy, error: oauthError } = useDiscordOAuth();
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

    const nameDirty = name.trim().length > 0 && name.trim() !== (user?.displayName ?? "").trim();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const avatarWrapRef = useRef<HTMLDivElement>(null);
    const [appearanceBusy, setAppearanceBusy] = useState(false);
    const [appearanceError, setAppearanceError] = useState<string | null>(null);
    // Menu flutuante de opções da foto (Alterar / Remover).
    const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

    // Fecha o menu se o clique cair fora do avatar.
    useEffect(() => {
        if (!avatarMenuOpen) return;

        function onPointerDown(event: MouseEvent) {
            if (!avatarWrapRef.current?.contains(event.target as Node)) {
                setAvatarMenuOpen(false);
            }
        }

        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [avatarMenuOpen]);

    function handleAvatarClick() {
        // Sem foto: clicar já abre o seletor de imagem.
        if (!user?.avatar) {
            fileInputRef.current?.click();
            return;
        }

        setAvatarMenuOpen((open) => !open);
    }

    async function handleAvatarFile(file: File | undefined) {
        if (!file || appearanceBusy) return;

        setAppearanceBusy(true);
        setAppearanceError(null);

        try {
            const dataUrl = await fileToCompressedDataUrl(file);

            if (dataUrl.length > 180_000) {
                throw new Error("Imagem muito grande mesmo após compressão.");
            }

            const { data } = await api.patch<User>("/auth/me", { avatar: dataUrl });
            updateUser(data);
            push("Foto atualizada.", "success");
        } catch (error) {
            setAppearanceError(getErrorMessage(error) ?? "Não foi possível atualizar a foto.");
        } finally {
            setAppearanceBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function clearAvatar() {
        if (appearanceBusy || !user?.avatar) return;

        setAppearanceBusy(true);
        setAppearanceError(null);

        try {
            const { data } = await api.patch<User>("/auth/me", { avatar: null });
            updateUser(data);
            push("Foto removida.", "success");
        } catch (error) {
            setAppearanceError(getErrorMessage(error) ?? "Não foi possível remover a foto.");
        } finally {
            setAppearanceBusy(false);
        }
    }

    // Fundo do perfil (cor primária + secundária): só vai ao banco quando confirmar.
    const [pendingFrom, setPendingFrom] = useState(() => normalizeHexColor(user?.bannerFrom ?? "") ?? DEFAULT_BANNER_FROM);
    const [pendingTo, setPendingTo] = useState(() => normalizeHexColor(user?.bannerTo ?? "") ?? DEFAULT_BANNER_TO);

    const bannerDirty =
        (normalizeHexColor(user?.bannerFrom ?? "") ?? DEFAULT_BANNER_FROM) !== pendingFrom ||
        (normalizeHexColor(user?.bannerTo ?? "") ?? DEFAULT_BANNER_TO) !== pendingTo;

    async function applyBanner() {
        if (appearanceBusy || !bannerDirty) return;

        setAppearanceBusy(true);
        setAppearanceError(null);

        try {
            const { data } = await api.patch<User>("/auth/me", {
                bannerFrom: pendingFrom.toLowerCase(),
                bannerTo: pendingTo.toLowerCase()
            });
            updateUser(data);
            push("Fundo atualizado.", "success");
        } catch (error) {
            setAppearanceError(getErrorMessage(error) ?? "Não foi possível aplicar o fundo.");
        } finally {
            setAppearanceBusy(false);
        }
    }

    async function resetBanner() {
        if (appearanceBusy || (!user?.bannerFrom && !user?.bannerTo)) return;

        setAppearanceBusy(true);
        setAppearanceError(null);

        try {
            const { data } = await api.patch<User>("/auth/me", { bannerFrom: null, bannerTo: null });
            updateUser(data);
            setPendingFrom(DEFAULT_BANNER_FROM);
            setPendingTo(DEFAULT_BANNER_TO);
        } catch (error) {
            setAppearanceError(getErrorMessage(error) ?? "Não foi possível resetar o fundo.");
        } finally {
            setAppearanceBusy(false);
        }
    }

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
                    <div
                        className={styles.banner}
                        style={{ background: `linear-gradient(120deg, ${pendingFrom}, ${pendingTo})` }}
                        aria-hidden="true"
                    />

                    <div className={styles.avatarWrap} ref={avatarWrapRef}>
                        <button
                            type="button"
                            className={styles.avatarClickable}
                            title={user?.avatar ? "Opções da foto" : "Adicionar foto"}
                            aria-label={user?.avatar ? "Opções da foto" : "Adicionar foto"}
                            onClick={handleAvatarClick}
                        >
                            <UserAvatar name={user?.displayName ?? "?"} avatar={user?.avatar} size={72} />
                            {!user?.avatar && (
                                <span className={styles.avatarHover} aria-hidden="true">
                                    <ImagePlus size={15} />
                                </span>
                            )}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(event) => { void handleAvatarFile(event.target.files?.[0]); }}
                        />
                        {user?.avatar && avatarMenuOpen && (
                            <div className={styles.avatarMenu} role="menu">
                                <button
                                    type="button"
                                    className={styles.avatarMenuBtn}
                                    onClick={() => {
                                        setAvatarMenuOpen(false);
                                        fileInputRef.current?.click();
                                    }}
                                >
                                    <ImagePlus size={13} />
                                    Alterar foto
                                </button>
                                <button
                                    type="button"
                                    className={styles.avatarMenuBtn}
                                    onClick={() => {
                                        setAvatarMenuOpen(false);
                                        void clearAvatar();
                                    }}
                                >
                                    <Trash2 size={13} />
                                    Remover foto
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={styles.customizeSection}>
                        <ColorField
                            label="Cor primária"
                            value={pendingFrom}
                            disabled={appearanceBusy}
                            onChange={setPendingFrom}
                        />
                        <ColorField
                            label="Cor secundária"
                            value={pendingTo}
                            disabled={appearanceBusy}
                            onChange={setPendingTo}
                        />

                        <div className={styles.customizeActions}>
                            <button
                                type="button"
                                className={styles.actionBtn}
                                disabled={appearanceBusy || !bannerDirty}
                                onClick={() => { void applyBanner(); }}
                            >
                                <Check size={15} />
                                {appearanceBusy ? "Salvando..." : "Aplicar cores"}
                            </button>
                            <button
                                type="button"
                                className={styles.customizeReset}
                                title="Voltar ao tema padrão"
                                disabled={appearanceBusy || (!user?.bannerFrom && !user?.bannerTo)}
                                onClick={() => { void resetBanner(); }}
                            >
                                <RotateCcw size={13} />
                                Tema padrão
                            </button>
                        </div>
                    </div>

                    {appearanceError && (
                        <p className={styles.errorChip} style={{ margin: "-2px 20px 0" }}>
                            <ShieldCheck size={13} />
                            {appearanceError}
                        </p>
                    )}

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
                            <ShieldCheck size={16} />
                        </span>
                        <div className={styles.sectionHeadText}>
                            <p className={styles.sectionTitle}>E-mail</p>
                            <p className={styles.sectionHint}>{user?.email ?? "Não informado"}</p>
                        </div>
                    </div>

                    {user?.discordVerified && (
                        <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => void requestSensitiveAction("email")}
                            disabled={oauthBusy}
                        >
                            <DiscordIcon size={15} />
                            {oauthBusy ? "Aguardando o Discord..." : "Alterar com Discord"}
                        </button>
                    )}
                </div>

                {oauthError && <p className={styles.errorChip} role="alert">{oauthError}</p>}

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

                    {user?.discordVerified && (
                        <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => void requestSensitiveAction("password")}
                            disabled={oauthBusy}
                        >
                            <DiscordIcon size={15} />
                            {oauthBusy ? "Aguardando o Discord..." : "Alterar com Discord"}
                        </button>
                    )}

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
                                    disabled={passwordBusy || Boolean(user?.discordVerified) || !currentPassword || !newPassword || !confirmPassword}
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
