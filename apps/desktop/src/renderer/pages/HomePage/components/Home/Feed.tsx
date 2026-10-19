import { useState } from "react";
import { Image, MessageCircle, Paperclip, Send, Share2, Smile, ThumbsUp } from "lucide-react";

import { useAuth } from "../../../../contexts/AuthContext";

import styles from "./Home.module.css";

interface FeedPost {
    id: string;
    author: string;
    initial: string;
    time: Date;
    text: string;
    liked: boolean;
    likes: number;
    comments: number;
}

function formatTime(date: Date): string {
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Feed() {
    const { user } = useAuth();
    const [draft, setDraft] = useState("");
    const [posts, setPosts] = useState<FeedPost[]>([]);

    const initial = (user?.displayName ?? "?").trim().charAt(0).toUpperCase() || "?";

    function handlePublish() {
        const text = draft.trim();
        if (!text) return;

        setPosts((current) => [
            {
                id: crypto.randomUUID(),
                author: user?.displayName ?? "Você",
                initial,
                time: new Date(),
                text,
                liked: false,
                likes: 0,
                comments: 0,
            },
            ...current,
        ]);
        setDraft("");
    }

    function toggleLike(id: string) {
        setPosts((current) => current.map((post) => (
            post.id === id
                ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }
                : post
        )));
    }

    function addComment(id: string) {
        setPosts((current) => current.map((post) => (
            post.id === id ? { ...post, comments: post.comments + 1 } : post
        )));
    }

    return (
        <section className={styles.feed} aria-label="Publicações">
            <h2 className={styles.feedTitle}>Feed</h2>

            <div className={styles.composer}>
                <span className={styles.listAvatar} aria-hidden="true">{initial}</span>
                <div className={styles.composerBody}>
                    <textarea
                        className={styles.composerInput}
                        rows={3}
                        value={draft}
                        placeholder="O que você quer compartilhar?"
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className={styles.composerBar}>
                        <div className={styles.composerTools}>
                            <button type="button" className={styles.toolBtn} title="Mídia" aria-label="Anexar mídia">
                                <Image size={16} aria-hidden="true" />
                            </button>
                            <button type="button" className={styles.toolBtn} title="Emoji" aria-label="Inserir emoji">
                                <Smile size={16} aria-hidden="true" />
                            </button>
                            <button type="button" className={styles.toolBtn} title="Anexo" aria-label="Anexar arquivo">
                                <Paperclip size={16} aria-hidden="true" />
                            </button>
                        </div>
                        <button
                            type="button"
                            className={styles.publishBtn}
                            disabled={!draft.trim()}
                            onClick={handlePublish}
                        >
                            <Send size={14} aria-hidden="true" />
                            Publicar
                        </button>
                    </div>
                </div>
            </div>

            {posts.length === 0 && (
                <p className={styles.empty}>Nenhuma publicação ainda. Compartilhe algo com a galera.</p>
            )}

            <div className={styles.postList}>
                {posts.map((post) => (
                    <article key={post.id} className={styles.postCard}>
                        <header className={styles.postHeader}>
                            <span className={styles.listAvatar} aria-hidden="true">{post.initial}</span>
                            <div className={styles.listText}>
                                <span className={styles.listName}>{post.author}</span>
                                <span className={styles.listSub}>{formatTime(post.time)}</span>
                            </div>
                        </header>

                        <p className={styles.postText}>{post.text}</p>

                        <footer className={styles.postFooter}>
                            <button
                                type="button"
                                className={`${styles.postBtn} ${post.liked ? styles.postBtnActive : ""}`}
                                aria-pressed={post.liked}
                                onClick={() => toggleLike(post.id)}
                            >
                                <ThumbsUp size={14} aria-hidden="true" />
                                Curtir{post.likes > 0 ? ` ${post.likes}` : ""}
                            </button>
                            <button type="button" className={styles.postBtn} onClick={() => addComment(post.id)}>
                                <MessageCircle size={14} aria-hidden="true" />
                                Comentar{post.comments > 0 ? ` ${post.comments}` : ""}
                            </button>
                            <button type="button" className={styles.postBtn}>
                                <Share2 size={14} aria-hidden="true" />
                                Compartilhar
                            </button>
                        </footer>
                    </article>
                ))}
            </div>
        </section>
    );
}
