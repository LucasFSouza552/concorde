
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
    | { type: "call-state"; groupId: string | null; concordeGroupId?: string | null };

export type UserSocketServerMessage =
    | { type: "pong" }
    | { type: "user-connected"; userId: string }
    | { type: "pong" }
    | { type: "channel-message"; message: NewMessage }
    | { type: "call-invite"; invite: CallInvite }
    | { type: "call-accepted"; callId: string }
    | { type: "call-declined"; callId: string }
    | { type: "call-cancelled"; callId: string }
    | { type: "call-redirect"; callId: string; groupId: string; concordeGroupId?: string | null }
    | { type: "peer-call-state"; userId: string; groupId: string | null; concordeGroupId?: string | null };;

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
    createdAt: number;
    expiresAt: number;
}

export interface DesktopSource {
    id: string;
    name: string;
    thumbnail: string;
    isScreen: boolean;
}

export interface ScreenQuality {
    width: number;
    height: number;
    frameRate: number;
}

export interface CallInvite {
    callId: string;
    groupId: string;
    fromUserId: string;
    fromDisplayName: string;
    concordeGroupId?: string;
    createdAt: number;
    expiresAt: number;
}