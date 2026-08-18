import * as Schema from "effect/Schema";

import { AuthInfo } from "@/auth/shared/schema.ts";


// --- Channel Identity ------------------------------------------------------

export type ChannelId = typeof ChannelId.Type;
export const ChannelId = Schema.String.pipe( Schema.brand( "ChannelId" ) );

export type ChannelIdParams = typeof ChannelIdParams.Type;
export const ChannelIdParams = Schema.Struct( { channelId: ChannelId } );


// --- Reactions -------------------------------------------------------------

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

export type Reaction = typeof Reaction.Type;
export const Reaction = Schema.Struct( {
	key: ReactionKey,
	glyph: Schema.String,
	label: Schema.String
} );

export const REACTIONS = [
	{ key: "like" as const, glyph: "👍", label: "Nice" },
	{ key: "laugh" as const, glyph: "😂", label: "Haha" },
	{ key: "wow" as const, glyph: "😮", label: "Wow" },
	{ key: "sad" as const, glyph: "😢", label: "Oh no" },
	{ key: "clap" as const, glyph: "👏", label: "Well played" },
	{ key: "think" as const, glyph: "🤔", label: "Hmm" },
	{ key: "fire" as const, glyph: "🔥", label: "On fire" },
	{ key: "party" as const, glyph: "🎉", label: "Let's go" },
	{ key: "eyes" as const, glyph: "👀", label: "Watching" },
	{ key: "salt" as const, glyph: "🧂", label: "Salty" }
].map( v => Reaction.make( v ) );


// --- Messages --------------------------------------------------------------

export const MAX_MESSAGE_LENGTH = 500;

export type ChatText = typeof ChatText.Type;
export const ChatText = Schema.TaggedStruct( "chat/Text", {
	text: Schema.String.check( Schema.isLengthBetween( 1, MAX_MESSAGE_LENGTH ) )
} );

export type ChatReaction = typeof ChatReaction.Type;
export const ChatReaction = Schema.TaggedStruct( "chat/Reaction", {
	key: ReactionKey
} );

export type ChatBody = typeof ChatBody.Type;
export const ChatBody = Schema.Union( [ ChatText, ChatReaction ] );

export type SendMessageInput = typeof SendMessageInput.Type;
export const SendMessageInput = Schema.Struct( { body: ChatBody } );

export type ChatMessage = typeof ChatMessage.Type;
export const ChatMessage = Schema.Struct( {
	id: Schema.String,
	at: Schema.Number,
	author: AuthInfo,
	body: ChatBody
} );


// --- Policy ----------------------------------------------------------------

export type ChatPolicy = typeof ChatPolicy.Type;
export const ChatPolicy = Schema.Struct( {
	text: Schema.Boolean,
	reactions: Schema.Boolean
} );

export type ChatHistory = typeof ChatHistory.Type;
export const ChatHistory = Schema.Struct( {
	policy: ChatPolicy,
	messages: Schema.Array( ChatMessage )
} );


// --- Errors ----------------------------------------------------------------

export class ChannelNotFound extends Schema.TaggedError<ChannelNotFound>()(
	"chat/ChannelNotFound",
	{ channelId: Schema.String },
	{ httpApiStatus: 404 }
) {}

export class MessageNotAllowed extends Schema.TaggedError<MessageNotAllowed>()(
	"chat/MessageNotAllowed",
	{ reason: Schema.String },
	{ httpApiStatus: 403 }
) {}

export type SendMessageError = typeof SendMessageError.Type;
export const SendMessageError = Schema.Union( [ ChannelNotFound, MessageNotAllowed ] );
