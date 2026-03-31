export const CONTRACT_VERSION = "1.0" as const;

export const CLIENT_EVENTS = {
  SESSION_HELLO: "session.hello",
  ROOM_GENERATE_CODE: "room.generate_code",
  ROOM_JOIN: "room.join",
  ROOM_LEAVE: "room.leave",
  MSG_SEND: "msg.send",
  TYPING_SET: "typing.set",
  PROFILE_UPDATE: "profile.update",
  GROUP_CREATE: "group.create",
  GROUP_JOIN: "group.join",
  MSG_READ: "msg.read",
} as const;

export const SERVER_EVENTS = {
  SESSION_READY: "session.ready",
  ROOM_CODE_GENERATED: "room.code_generated",
  ROOM_JOINED: "room.joined",
  ROOM_LEFT: "room.left",
  ROOM_MEMBER_JOINED: "room.member_joined",
  ROOM_MEMBER_LEFT: "room.member_left",
  MSG_NEW: "msg.new",
  MSG_ACK: "msg.ack",
  TYPING_UPDATE: "typing.update",
  PRESENCE_UPDATE: "presence.update",
  GROUP_CREATED: "group.created",
  ERROR: "error",
  SECURITY_NOTICE: "security.notice",
} as const;

export type ClientEventName = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];
export type ServerEventName = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];

export type Envelope<TEvent extends string, TData> = {
  v: typeof CONTRACT_VERSION;
  event: TEvent;
  reqId?: string;
  ts: number;
  data: TData;
};

export type EmojiIdentity = {
  username: string;
  emoji: string;
  avatarUrl?: string;
};

export type SessionHelloPayload = {
  deviceId: string;
  appVersion?: string;
  identity: EmojiIdentity;
};

export type SessionReadyPayload = {
  sessionId: string;
  serverTime: number;
  features: {
    e2ee: boolean;
    autoShred: boolean;
    groups: boolean;
  };
};

export type RoomGenerateCodePayload = {
  kind: "direct" | "group";
  ttlMinutes: number;
};

export type RoomCodeGeneratedPayload = {
  roomId: string;
  roomCode: string;
  expiresAt: number;
  kind: "direct" | "group";
};

export type RoomJoinPayload = {
  roomCode: string;
  identity: EmojiIdentity;
};

export type RoomJoinedPayload = {
  roomId: string;
  roomCode: string;
  kind: "direct" | "group";
  joinedAt: number;
  members: Array<{
    peerId: string;
    username: string;
    emoji: string;
    online: boolean;
  }>;
  security: {
    e2eeRequired: boolean;
    algorithm: "AES-256-GCM" | "XCHACHA20-POLY1305";
  };
};

export type GroupCreatePayload = {
  name: string;
  emoji: string;
  ttlMinutes: number;
};

export type GroupCreatedPayload = {
  roomId: string;
  roomCode: string;
  name: string;
  emoji: string;
  expiresAt: number;
};

export type MessageSendPayload = {
  roomId: string;
  clientMsgId: string;
  bodyCiphertext: string;
  nonce?: string;
  sentAt: number;
  autoShredSeconds?: number;
};

export type MessageNewPayload = {
  roomId: string;
  msgId: string;
  fromPeerId: string;
  fromEmoji: string;
  bodyCiphertext: string;
  nonce?: string;
  sentAt: number;
  autoShredAt?: number;
};

export type MessageAckPayload = {
  roomId: string;
  clientMsgId: string;
  msgId: string;
  deliveredAt: number;
};

export type MessageReadPayload = {
  roomId: string;
  msgId: string;
  readAt: number;
};

export type TypingSetPayload = {
  roomId: string;
  isTyping: boolean;
};

export type TypingUpdatePayload = {
  roomId: string;
  peerId: string;
  isTyping: boolean;
  ts: number;
};

export type PresenceUpdatePayload = {
  roomId: string;
  peerId: string;
  online: boolean;
  lastSeenAt?: number;
};

export type RoomLeavePayload = {
  roomId: string;
};

export type ErrorPayload = {
  code:
    | "INVALID_CODE"
    | "ROOM_EXPIRED"
    | "ROOM_FULL"
    | "UNAUTHORIZED"
    | "RATE_LIMITED"
    | "BAD_PAYLOAD"
    | "INTERNAL";
  message: string;
  event?: string;
};

export type SecurityNoticePayload = {
  roomId: string;
  type: "E2EE_REQUIRED" | "KEY_ROTATED" | "AUTO_SHRED";
  message: string;
};

export type ClientToServerEventMap = {
  [CLIENT_EVENTS.SESSION_HELLO]: SessionHelloPayload;
  [CLIENT_EVENTS.ROOM_GENERATE_CODE]: RoomGenerateCodePayload;
  [CLIENT_EVENTS.ROOM_JOIN]: RoomJoinPayload;
  [CLIENT_EVENTS.ROOM_LEAVE]: RoomLeavePayload;
  [CLIENT_EVENTS.MSG_SEND]: MessageSendPayload;
  [CLIENT_EVENTS.TYPING_SET]: TypingSetPayload;
  [CLIENT_EVENTS.PROFILE_UPDATE]: EmojiIdentity;
  [CLIENT_EVENTS.GROUP_CREATE]: GroupCreatePayload;
  [CLIENT_EVENTS.GROUP_JOIN]: RoomJoinPayload;
  [CLIENT_EVENTS.MSG_READ]: MessageReadPayload;
};

export type ServerToClientEventMap = {
  [SERVER_EVENTS.SESSION_READY]: SessionReadyPayload;
  [SERVER_EVENTS.ROOM_CODE_GENERATED]: RoomCodeGeneratedPayload;
  [SERVER_EVENTS.ROOM_JOINED]: RoomJoinedPayload;
  [SERVER_EVENTS.ROOM_LEFT]: RoomLeavePayload;
  [SERVER_EVENTS.ROOM_MEMBER_JOINED]: { roomId: string; peerId: string; username: string; emoji: string };
  [SERVER_EVENTS.ROOM_MEMBER_LEFT]: { roomId: string; peerId: string; leftAt: number };
  [SERVER_EVENTS.MSG_NEW]: MessageNewPayload;
  [SERVER_EVENTS.MSG_ACK]: MessageAckPayload;
  [SERVER_EVENTS.TYPING_UPDATE]: TypingUpdatePayload;
  [SERVER_EVENTS.PRESENCE_UPDATE]: PresenceUpdatePayload;
  [SERVER_EVENTS.GROUP_CREATED]: GroupCreatedPayload;
  [SERVER_EVENTS.ERROR]: ErrorPayload;
  [SERVER_EVENTS.SECURITY_NOTICE]: SecurityNoticePayload;
};

export type ClientEnvelope<E extends ClientEventName> = Envelope<E, ClientToServerEventMap[E]>;
export type ServerEnvelope<E extends ServerEventName> = Envelope<E, ServerToClientEventMap[E]>;

export type AnyClientEnvelope = {
  [E in ClientEventName]: ClientEnvelope<E>;
}[ClientEventName];

export type AnyServerEnvelope = {
  [E in ServerEventName]: ServerEnvelope<E>;
}[ServerEventName];
