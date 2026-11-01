/**
 * Uso único hoje: o tipo PeerCallState consumido por CallArea/ChatView.
 * O GET /user/:id/presence foi substituído pelo cache compartilhado de
 * presença (useFriendsPresence) — ver getCachedPresence em ChatView.
 */
export interface PeerCallState {
    groupId: string;
    concordeGroupId: string | null;
}
