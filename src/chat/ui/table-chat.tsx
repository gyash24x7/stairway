import { cn } from "cn";
import {
	MessageSquareIcon,
	MicIcon,
	MicOffIcon,
	PhoneIcon,
	PhoneOffIcon,
	SendIcon,
	VideoIcon,
	VideoOffIcon,
	XIcon
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import type { ChatMember, ChatMessage, RefusalReason } from "@/chat/schema";
import { MAX_CALL_SIZE, MAX_MESSAGE_LENGTH } from "@/chat/schema";
import type { CallSession, CallState } from "@/chat/ui/call";
import { useCall } from "@/chat/ui/call";
import type { ChatConnection, ChatState } from "@/chat/ui/connection";
import { useChatConnection, useChatState } from "@/chat/ui/connection";
import type { GameName } from "@/shared/games";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { Button } from "@/shared/primitives/button";
import { Input } from "@/shared/primitives/input";
import { toast } from "@/shared/primitives/sonner";


const REFUSALS: Record<RefusalReason, string> = {
	"call-full": `The call is full — at most ${ MAX_CALL_SIZE } people can be on video at once.`,
	"not-a-player": "Only players at the table can join the call.",
	"joined-elsewhere": "You joined the call from another tab, so this one left it.",
	"too-fast": "Slow down — that message was not sent."
};

/**
 * The chat for the table in the URL: text for everybody at it, and a video
 * call for the players.
 *
 * Mounted beside a game's page rather than inside it, on both the classic
 * route and the world's overlay, so no game has to know it exists. It renders
 * nothing until the server has let this user in — a stranger looking at a
 * table they neither sit at nor watch sees no chat at all.
 */
export function TableChat( { game }: { game: GameName } ) {
	const { gameId } = useParams();
	const connection = useChatConnection( game, gameId );
	const chat = useChatState( connection );
	const { session, state: call } = useCall( connection, chat );
	const [ open, setOpen ] = useState( false );
	const [ seen, setSeen ] = useState<number>();

	// The backlog waiting on arrival counts as read: it is the table's history,
	// not news. Set during render, once, the way React derives state from props.
	if ( seen === undefined && chat.admitted ) {
		setSeen( chat.messages.length );
	}

	useEffect( () => {
		if ( chat.refusal ) {
			toast.error( REFUSALS[ chat.refusal.reason ] );
		}
	}, [ chat.refusal ] );

	useEffect( () => {
		if ( call.error ) {
			toast.error( call.error );
		}
	}, [ call.error ] );

	if ( !connection || !session || !chat.admitted ) {
		return null;
	}

	// Counted from when the panel was last closed; nothing is unread while it is open.
	const unread = open ? 0 : Math.max( 0, chat.messages.length - ( seen ?? 0 ) );
	const inCall = Array.from( chat.members.values() ).filter( member => member.inCall );

	return (
		<div className={ "fixed z-40 bottom-3 left-3 right-3 md:right-auto flex flex-col items-start gap-2 pointer-events-none" }>
			{ open && (
				<ChatPanel
					chat={ chat }
					connection={ connection }
					call={ call }
					session={ session }
					onClose={ () => {
						setSeen( chat.messages.length );
						setOpen( false );
					} }
				/>
			) }

			{ !open && (
				<Button
					className={ "pointer-events-auto relative" }
					onClick={ () => setOpen( true ) }
					aria-label={ "Open table chat" }
				>
					<MessageSquareIcon className={ "w-4 h-4" }/>
					CHAT
					{ ( inCall.length > 0 || call.phase === "live" ) && <VideoIcon className={ "w-4 h-4" }/> }
					{ unread > 0 && (
						<span className={ cn(
							"absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full",
							"bg-destructive text-white text-xs flex items-center justify-center border-2 border-outline"
						) }>
							{ unread > 99 ? "99+" : unread }
						</span>
					) }
				</Button>
			) }
		</div>
	);
}

type PanelProps = {
	chat: ChatState;
	connection: ChatConnection;
	call: CallState;
	session: CallSession;
	onClose: () => void;
};

function ChatPanel( { chat, connection, call, session, onClose }: PanelProps ) {
	const self = chat.self;
	const others = Array.from( chat.members.values() );
	const inCall = others.filter( member => member.inCall );
	const showCall = call.phase === "live" || inCall.length > 0;

	return (
		<div className={ cn(
			"pointer-events-auto w-full md:w-96 max-h-[80vh] flex flex-col",
			"rounded-md border-2 border-outline bg-background shadow-md"
		) }>
			<header className={ "flex items-center gap-2 p-2 border-b-2 border-outline" }>
				<MessageSquareIcon className={ "w-4 h-4" }/>
				<span className={ "font-heading text-sm flex-1" }>
					TABLE CHAT · { others.length + 1 } HERE
				</span>
				{ chat.status !== "open" && (
					<span className={ "text-xs text-muted-foreground" }>
						{ chat.status === "failed" ? "offline" : "reconnecting…" }
					</span>
				) }
				<Button size={ "icon" } variant={ "neutral" } onClick={ onClose } aria-label={ "Close chat" }>
					<XIcon className={ "w-4 h-4" }/>
				</Button>
			</header>

			{ self && (
				<CallControls self={ self } chat={ chat } call={ call } session={ session } inCall={ inCall.length }/>
			) }

			{ showCall && self && (
				<div className={ "grid grid-cols-2 gap-1 p-1 border-b-2 border-outline" }>
					{ call.phase === "live" && (
						<VideoTile
							member={ { ...self, audio: call.media.audio, video: call.media.video } }
							stream={ call.local }
							local
						/>
					) }
					{ inCall.map( member => (
						<VideoTile
							key={ member.connId }
							member={ member }
							stream={ call.phase === "live" ? call.remotes.get( member.connId ) : undefined }
						/>
					) ) }
				</div>
			) }

			<MessageList messages={ chat.messages } selfUserId={ self?.userId }/>
			<MessageInput onSay={ connection.say } disabled={ chat.status !== "open" }/>
		</div>
	);
}

function CallControls( { self, chat, call, session, inCall }: {
	self: ChatMember;
	chat: ChatState;
	call: CallState;
	session: CallSession;
	inCall: number;
} ) {
	if ( self.role !== "player" ) {
		return (
			<p className={ "text-xs text-muted-foreground px-2 py-1 border-b-2 border-outline" }>
				You are watching. Only players can join the video call.
			</p>
		);
	}

	if ( call.phase !== "live" ) {
		const full = inCall >= MAX_CALL_SIZE;
		return (
			<div className={ "flex items-center gap-2 p-2 border-b-2 border-outline" }>
				<Button
					size={ "sm" }
					disabled={ call.phase === "starting" || full || chat.status !== "open" }
					onClick={ () => void session.start( { audio: true, video: true } ) }
				>
					<VideoIcon className={ "w-4 h-4" }/>
					{ call.phase === "starting" ? "STARTING…" : "JOIN VIDEO" }
				</Button>
				<Button
					size={ "sm" }
					variant={ "neutral" }
					disabled={ call.phase === "starting" || full || chat.status !== "open" }
					onClick={ () => void session.start( { audio: true, video: false } ) }
				>
					<PhoneIcon className={ "w-4 h-4" }/>
					AUDIO ONLY
				</Button>
				<span className={ "text-xs text-muted-foreground ml-auto" }>
					{ full ? "Call is full" : `${ inCall } on call` }
				</span>
			</div>
		);
	}

	return (
		<div className={ "flex items-center gap-2 p-2 border-b-2 border-outline" }>
			<Button
				size={ "icon" }
				variant={ call.media.audio ? "neutral" : "default" }
				aria-label={ call.media.audio ? "Mute" : "Unmute" }
				onClick={ () => session.setMedia( { ...call.media, audio: !call.media.audio } ) }
			>
				{ call.media.audio ? <MicIcon className={ "w-4 h-4" }/> : <MicOffIcon className={ "w-4 h-4" }/> }
			</Button>
			<Button
				size={ "icon" }
				variant={ call.media.video ? "neutral" : "default" }
				disabled={ !call.hasCamera }
				aria-label={ call.media.video ? "Turn camera off" : "Turn camera on" }
				onClick={ () => session.setMedia( { ...call.media, video: !call.media.video } ) }
			>
				{ call.media.video ? <VideoIcon className={ "w-4 h-4" }/> : <VideoOffIcon className={ "w-4 h-4" }/> }
			</Button>
			<Button size={ "sm" } className={ "ml-auto" } onClick={ session.stop }>
				<PhoneOffIcon className={ "w-4 h-4" }/>
				LEAVE
			</Button>
		</div>
	);
}

function VideoTile( { member, stream, local = false }: {
	member: ChatMember;
	stream: MediaStream | undefined;
	local?: boolean;
} ) {
	const video = useRef<HTMLVideoElement>( null );
	const speaking = useSpeaking( member.audio ? stream : undefined );

	useEffect( () => {
		if ( video.current && video.current.srcObject !== ( stream ?? null ) ) {
			video.current.srcObject = stream ?? null;
		}
	}, [ stream ] );

	return (
		<div className={ cn(
			"relative aspect-video rounded-base overflow-hidden bg-neutral-dark border-2",
			speaking ? "border-accent" : "border-outline"
		) }>
			<video
				ref={ video }
				autoPlay
				playsInline
				muted={ local }
				className={ cn(
					"w-full h-full object-cover",
					local && "-scale-x-100",
					!member.video && "invisible"
				) }
			/>
			{ !member.video && (
				<div className={ "absolute inset-0 flex items-center justify-center" }>
					<Avatar className={ "w-12 h-12 rounded-full border-2 border-outline" }>
						<AvatarImage src={ member.avatar } alt={ "" } className={ "bg-background" }/>
					</Avatar>
				</div>
			) }
			<div className={ "absolute bottom-0 inset-x-0 flex items-center gap-1 px-1 bg-black/50 text-white text-xs" }>
				{ !member.audio && <MicOffIcon className={ "w-3 h-3 shrink-0" }/> }
				<span className={ "truncate" }>{ local ? "You" : member.name }</span>
			</div>
		</div>
	);
}

/**
 * Whether there is voice on `stream` right now, polled a few times a second
 * from an analyser. Only used to light up a tile's border, so it trades
 * precision for cheapness.
 */
function useSpeaking( stream: MediaStream | undefined ) {
	const [ speaking, setSpeaking ] = useState( false );

	useEffect( () => {
		if ( !stream || stream.getAudioTracks().length === 0 ) {
			return;
		}

		const context = new AudioContext();
		const analyser = context.createAnalyser();
		analyser.fftSize = 512;
		const source = context.createMediaStreamSource( stream );
		source.connect( analyser );
		const samples = new Uint8Array( analyser.fftSize );

		const timer = setInterval( () => {
			analyser.getByteTimeDomainData( samples );
			let sum = 0;
			for ( const sample of samples ) {
				const centred = ( sample - 128 ) / 128;
				sum += centred * centred;
			}
			setSpeaking( Math.sqrt( sum / samples.length ) > 0.04 );
		}, 200 );

		return () => {
			clearInterval( timer );
			source.disconnect();
			void context.close();
			setSpeaking( false );
		};
	}, [ stream ] );

	return speaking;
}

function MessageList( { messages, selfUserId }: {
	messages: ReadonlyArray<ChatMessage>;
	selfUserId: string | undefined;
} ) {
	const end = useRef<HTMLDivElement>( null );

	useEffect( () => {
		end.current?.scrollIntoView( { block: "end" } );
	}, [ messages.length ] );

	return (
		<div className={ "flex-1 min-h-32 max-h-72 overflow-y-auto p-2 flex flex-col gap-2" }>
			{ messages.length === 0 && (
				<p className={ "text-xs text-muted-foreground text-center py-4" }>
					No messages yet. Say hello to the table.
				</p>
			) }
			{ messages.map( message => {
				const mine = message.userId === selfUserId;
				return (
					<div key={ message.id } className={ cn( "flex gap-2 items-start", mine && "flex-row-reverse" ) }>
						<Avatar className={ "w-6 h-6 rounded-full border-2 border-outline shrink-0" }>
							<AvatarImage src={ message.avatar } alt={ "" } className={ "bg-background" }/>
						</Avatar>
						<div className={ cn(
							"rounded-base border-2 border-outline px-2 py-1 text-sm max-w-[75%] break-words",
							mine ? "bg-accent text-neutral-dark" : "bg-surface"
						) }>
							{ !mine && <p className={ "text-xs font-heading" }>{ message.name }</p> }
							<p className={ "whitespace-pre-wrap" }>{ message.text }</p>
						</div>
					</div>
				);
			} ) }
			<div ref={ end }/>
		</div>
	);
}

function MessageInput( { onSay, disabled }: { onSay: ( text: string ) => void; disabled: boolean } ) {
	const [ text, setText ] = useState( "" );

	return (
		<form
			className={ "flex gap-2 p-2 border-t-2 border-outline" }
			onSubmit={ event => {
				event.preventDefault();
				if ( text.trim() ) {
					onSay( text.trim() );
					setText( "" );
				}
			} }
		>
			<Input
				value={ text }
				maxLength={ MAX_MESSAGE_LENGTH }
				placeholder={ "Message the table" }
				disabled={ disabled }
				onChange={ event => setText( event.target.value ) }
				// Kept from reaching the window, where a game may be listening for
				// keys of its own (wordle's guesses, the world's walking).
				onKeyDown={ event => event.stopPropagation() }
			/>
			<Button type={ "submit" } size={ "icon" } disabled={ disabled || !text.trim() } aria-label={ "Send" }>
				<SendIcon className={ "w-4 h-4" }/>
			</Button>
		</form>
	);
}
