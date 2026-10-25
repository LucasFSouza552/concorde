
export type UserStatus = "online" | "away" | "busy" | "invisible" | "offline";

export interface User {
    id: string;
    username: string;
    displayName: string,
    friendsOnly: boolean,
    email: string;
    createdAt: number;
}

export interface LoginResponse {
    user: User;
    token: string;
    refreshToken: string;
}

export interface ApiError {
    message: string;
}

export interface Credentials {
    email: string;
    password: string;
}

export interface RegisterData extends Credentials {
    username: string;
}

export type FriendshipStatus = "pending" | "accepted";

export interface Friend {
    id: string;
    username: string;
    displayName: string;
}

export interface UserPresence {
    status: UserStatus;
    online: boolean;
    inCall: boolean;
    groupId: string | null;
    concordeGroupId: string | null;
    /** mensagem de status personalizada (até 80 caracteres) */
    customMessage?: string | null;
}

export interface PresenceBatchResponse {
    presences: Record<string, UserPresence>;
}

export interface Friendship {
    userId: string;
    friendId: string;
    status: FriendshipStatus;
    createdAt: number;
}

export type SendFriendRequestResult = "sent" | "already-friends" | "pending" | "self";

export type UserSocketClientMessage =
    | { type: "auth"; token: string }
    | { type: "ping" }
    | { type: "set-status"; status: UserStatus; customMessage?: string }
    | { type: "call-state"; groupId: string | null; concordeGroupId?: string | null };

export type UserSocketServerMessage =
    | { type: "pong" }
    | { type: "user-connected"; userId: string }
    | { type: "channel-message"; message: NewMessage }
    | { type: "channel-message-deleted"; channelId: string; messageId: string }
    | { type: "call-invite"; invite: CallInvite }
    | { type: "call-accepted"; callId: string }
    | { type: "call-declined"; callId: string }
    | { type: "call-cancelled"; callId: string }
    | { type: "peer-status"; userId: string; status: UserStatus; customMessage?: string | null }
    | { type: "peer-call-state"; userId: string; groupId: string | null; concordeGroupId?: string | null }
    | { type: "group-kicked"; groupId: string; groupName: string; reason: "removed" | "left" | "dissolved" };

// Group

export interface CreateGroupInput {
    name: string;
}

export type GroupRole = "owner" | "admin" | "member";

export interface GroupWithRole {
    id: string;
    name: string;
    ownerId: string;
    createdAt: number;
    role: GroupRole;
    joinedAt: number;
    memberCount: number;
}

// Channels
export type ChannelKind = 'dm' | 'group';
export type MessageKind = 'text' | 'image';

export interface NewChannel {
    id: string;
    groupId: string | null;
    kind: ChannelKind;
    name: string | null;
    dmKey: string | null;
    createdAt: number
}

export interface NewMessage {
    id: string;
    channelId: string;
    userId: string;
    kind: MessageKind;
    content: string;
    createdAt: number;
}

export type CallInviteStatus = "ringing" | "accepted" | "declined" | "cancelled" | "expired";

export interface CallInvite {
    callId: string;
    groupId: string;
    fromUserId: string;
    fromDisplayName: string;
    concordeGroupId?: string;
    createdAt: number;
    expiresAt: number;
}

export interface DesktopSource {
    id: string;
    name: string;
    thumbnail: string;
    isScreen: boolean;
    /** janela minimizada: Concorde lista, mas a pré-visualização fica vazia */
    minimized?: boolean;
}

export interface ScreenQuality {
    width: number;
    height: number;
    frameRate: number;
}
