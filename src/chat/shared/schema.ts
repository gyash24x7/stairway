import * as Schema from "effect/Schema";

import { PlayerInfo } from "@/shared/swish/schema.ts";


// --- Channel identity ------------------------------------------------------

/**
 * A chat channel's unique id, branded. For a game-backed channel this is the
 * game id, so the client never needs a lookup — but the chat subsystem treats it
 * as opaque and only ever validates it against its own `channels` table.
 */
export type ChannelId = typeof ChannelId.Type;
export const ChannelId = Schema.String.pipe( Schema.brand( "ChannelId" ) );

/** The `:channelId` path-param struct every chat endpoint takes. */
export type ChannelIdParams = typeof ChannelIdParams.Type;
export const ChannelIdParams = Schema.Struct( { channelId: ChannelId } );


// --- Reactions -------------------------------------------------------------

/**
 * The closed reaction vocabulary.
 *
 * The set being *closed* is load-bearing, not cosmetic: a channel restricted to
 * reactions is only meaningfully restricted if the vocabulary is bounded.
 * Arbitrary emoji would make a reactions-only channel a text channel with extra
 * steps, which would defeat the whole point for hidden-information games (see
 * `REACTIONS_ONLY_POLICY`). Keep this list short for the same reason — every
 * added entry widens the covert channel a determined pair could signal through.
 *
 * Stickers, when they arrive, belong here as entries whose `glyph` is an asset
 * path rather than an emoji — not as a third message kind.
 */
export const REACTION_KEYS = [
	"like",
	"laugh",
	"wow",
	"sad",
	"clap",
	"think",
	"fire",
	"party",
	"eyes",
	"salt"
] as const;

export type ReactionKey = typeof ReactionKey.Type;
export const ReactionKey = Schema.Literals( REACTION_KEYS );

/** The palette the client renders, in display order. */
export const REACTIONS: ReadonlyArray<{
	readonly key: ReactionKey;
	readonly glyph: string;
	readonly label: string;
}> = [
	{ key: "like", glyph: "👍", label: "Nice" },
	{ key: "laugh", glyph: "😂", label: "Haha" },
	{ key: "wow", glyph: "😮", label: "Wow" },
	{ key: "sad", glyph: "😢", label: "Oh no" },
	{ key: "clap", glyph: "👏", label: "Well played" },
	{ key: "think", glyph: "🤔", label: "Hmm" },
	{ key: "fire", glyph: "🔥", label: "On fire" },
	{ key: "party", glyph: "🎉", label: "Let's go" },
	{ key: "eyes", glyph: "👀", label: "Watching" },
	{ key: "salt", glyph: "🧂", label: "Salty" }
];


// --- Messages --------------------------------------------------------------

/** The longest a single text message may be. */
export const MAX_MESSAGE_LENGTH = 500;

/** A free-text message. Only permitted on channels whose policy allows `text`. */
export type ChatText = typeof ChatText.Type;
export const ChatText = Schema.TaggedStruct( "chat/Text", {
	text: Schema.String.check( Schema.isLengthBetween( 1, MAX_MESSAGE_LENGTH ) )
} );

/** A reaction from the closed palette. */
export type ChatReaction = typeof ChatReaction.Type;
export const ChatReaction = Schema.TaggedStruct( "chat/Reaction", {
	key: ReactionKey
} );

/** What a message carries — the unit the channel policy gates. */
export type ChatBody = typeof ChatBody.Type;
export const ChatBody = Schema.Union( [ ChatText, ChatReaction ] );

/**
 * The send payload. The body is wrapped in a struct rather than posted bare:
 * a top-level union payload makes the generated `HttpApiClient` expose one
 * overload per member, so a caller holding a `ChatBody` matches neither.
 */
export type SendMessageInput = typeof SendMessageInput.Type;
export const SendMessageInput = Schema.Struct( { body: ChatBody } );

/**
 * A posted message. The `author` is stamped server-side from the session, never
 * taken from the client, so a message can't be attributed to someone else.
 */
export type ChatMessage = typeof ChatMessage.Type;
export const ChatMessage = Schema.TaggedStruct( "chat/Message", {
	id: Schema.String,
	at: Schema.Number,
	author: PlayerInfo,
	body: ChatBody
} );


// --- Policy ----------------------------------------------------------------

/**
 * What a channel permits. Whoever creates the channel passes this in; it is
 * stored on the `channels` row and fixed for the channel's life — the chat
 * subsystem never reads game state to decide, which is exactly what keeps it
 * self-sufficient. The flip side is that a reactions-only channel stays that way
 * throughout, including before the game starts and after it finishes.
 */
export type ChatPolicy = typeof ChatPolicy.Type;
export const ChatPolicy = Schema.Struct( {
	text: Schema.Boolean,
	reactions: Schema.Boolean
} );

/** A channel's backlog plus the policy the client should render against. */
export type ChatHistory = typeof ChatHistory.Type;
export const ChatHistory = Schema.Struct( {
	policy: ChatPolicy,
	messages: Schema.Array( ChatMessage )
} );


// --- Socket frames ---------------------------------------------------------

/**
 * What the `/chat/{channelId}` socket pushes. Tagged from the start so more frame
 * kinds (typing indicators, presence) can be added without a breaking change —
 * the mistake worth not repeating from the untagged `/sync/` frames.
 */
export type ChatFrame = typeof ChatFrame.Type;
export const ChatFrame = Schema.TaggedStruct( "chat/Frame", {
	message: ChatMessage
} );


// --- Errors ----------------------------------------------------------------

/** No `channels` row for this id — the channel was never created, or the id is wrong. */
export class ChannelNotFound extends Schema.TaggedErrorClass<ChannelNotFound>()(
	"chat/ChannelNotFound",
	{ channelId: Schema.String },
	{ httpApiStatus: 404 }
) {}

/** The channel's policy forbids this kind of message. */
export class MessageNotAllowed extends Schema.TaggedErrorClass<MessageNotAllowed>()(
	"chat/MessageNotAllowed",
	{ reason: Schema.String },
	{ httpApiStatus: 403 }
) {}

/** The sender is posting faster than the per-channel rate limit allows. */
export class TooManyMessages extends Schema.TaggedErrorClass<TooManyMessages>()(
	"chat/TooManyMessages",
	{},
	{ httpApiStatus: 429 }
) {}

/** Union of the errors a `sendMessage` can surface to the client. */
export type SendMessageError = typeof SendMessageError.Type;
export const SendMessageError = Schema.Union( [
	ChannelNotFound,
	MessageNotAllowed,
	TooManyMessages
] );
