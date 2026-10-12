
export interface Message {
    type: string;
}

export interface JoinMessage extends Message {
    type: "join";
    userId: string;
    username: string;
}

export interface ChatMessage extends Message {
    type: "chat";
    content: string;
}

export interface DirectMessage {
    type: "offer" | "answer" | "ice-candidate";
    to: string;
    from?: string;
}

// 

export interface OfferMessage extends DirectMessage {
    type: "offer";
    sdp: string;
}

export interface AnswerMessage extends DirectMessage {
    type: "answer";
    sdp: string;
}

export interface IceCandidateMessage extends DirectMessage {
    type: "ice-candidate";
    candidate: {
        candidate?: string;
        sdpMid?: string | null;
        sdpMLineIndex?: number | null;
    };
}

export interface ForwardedOfferMessage extends OfferMessage {
    from: string;
}

export interface ForwardedAnswerMessage extends AnswerMessage {
    from: string;
}

export interface ForwardedIceCandidateMessage extends IceCandidateMessage {
    from: string;
}

export interface MuteStateMessage extends Message {
    type: "mute-state";
    muted: boolean;
    deafened: boolean;
}

export interface ForwardedMuteStateMessage extends MuteStateMessage {
    from: string;
}

export interface ScreenShareStateMessage extends Message {
    type: "screen-share";
    sharing: boolean;
}

export interface ForwardedScreenShareStateMessage extends ScreenShareStateMessage {
    from: string;
}

export type DirectClientMessage = OfferMessage | AnswerMessage | IceCandidateMessage;

export type ClientMessage =
    | JoinMessage
    | ChatMessage
    | MuteStateMessage
    | ScreenShareStateMessage
    | DirectClientMessage;

export interface Peer {
    userId: string;
    username: string;
}

export interface PeerJoinedMessage {
    type: "peer-joined";
    peer: Peer;
}

export interface PeerLeftMessage {
    type: "peer-left";
    userId: string;
}

export interface PeersMessage {
    type: "peers";
    peers: Peer[];
}

export type OutgoingDirectMessage = OfferMessage | AnswerMessage | IceCandidateMessage;

export type ForwardedDirectMessage =
    | ForwardedOfferMessage
    | ForwardedAnswerMessage
    | ForwardedScreenShareStateMessage
    | ForwardedIceCandidateMessage
    | ForwardedMuteStateMessage;

export type ServerMessage =
    | PeerJoinedMessage
    | PeerLeftMessage
    | PeersMessage
    | ForwardedDirectMessage
    | ChatMessage;