"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleIcon, XIcon } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { useChat } from "@/chat/client/use-chat.ts";
import {
	ChatReaction,
	ChatText,
	MAX_MESSAGE_LENGTH,
	type ChatMessage,
	REACTIONS
} from "@/chat/shared/schema.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { Input } from "@/shared/ui/primitives/input.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

/**
 * The one chat surface, shared by every game — mounted into `GameInfo`'s
 * `actions` slot so its trigger sits alongside the copy-code button.
 *
 * What the composer offers is driven entirely by the channel's server-side
 * policy: on a reactions-only channel the text input is simply absent. That is a
 * courtesy, not a control — the API rejects a disallowed body regardless.
 */
export function ChatPanel( { channelId }: { channelId: string } ) {
	const [ open, setOpen ] = useState( false );
	const [ draft, setDraft ] = useState( "" );
	const [ seenCount, setSeenCount ] = useState( 0 );
	const listRef = useRef<HTMLDivElement>( null );

	const { authInfo } = useAuth();
	const { messages, policy, error, send, isSending } = useChat( channelId );

	const unread = Math.max( 0, messages.length - seenCount );

	useEffect( () => {
		if ( open ) {
			setSeenCount( messages.length );
			listRef.current?.scrollTo( { top: listRef.current.scrollHeight } );
		}
	}, [ open, messages.length ] );

	// No channel row — a game created before chat existed. Offer nothing rather
	// than a button that can only fail.
	if ( error ) {
		return null;
	}

	const submitText = ( event: FormEvent ) => {
		event.preventDefault();
		const text = draft.trim();
		if ( !text || isSending ) {
			return;
		}

		send( ChatText.make( { text } ) );
		setDraft( "" );
	};

	return (
		<Drawer direction={ "right" } open={ open } onOpenChange={ setOpen }>
			<Button
				onClick={ () => setOpen( true ) }
				size={ "icon" }
				className={ "relative w-8 h-8 md:h-10 md:w-10" }
			>
				<MessageCircleIcon className={ "w-4 h-4 md:h-6 md:w-6" }/>
				{ unread > 0 && (
					<span
						className={ cn(
							"absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1",
							"rounded-full bg-background border-2 border-black",
							"text-[10px] font-semibold leading-none",
							"flex items-center justify-center"
						) }
					>
						{ unread > 9 ? "9+" : unread }
					</span>
				) }
			</Button>

			<DrawerContent>
				<div className={ "flex flex-col h-full" }>
					<DrawerHeader
						className={ "flex-row items-center justify-between border-b border-black shrink-0" }
					>
						<DrawerTitle>CHAT</DrawerTitle>
						<DrawerDescription className={ "sr-only" }>
							Messages and reactions for this game
						</DrawerDescription>
						<DrawerClose
							className={ cn(
								"w-8 h-8 rounded-md flex items-center justify-center",
								"hover:bg-accent/30 transition-colors cursor-pointer"
							) }
						>
							<XIcon className={ "w-5 h-5" }/>
						</DrawerClose>
					</DrawerHeader>

					<div
						ref={ listRef }
						className={ "flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" }
					>
						{ messages.length === 0 && (
							<p className={ "text-xs md:text-sm opacity-60 py-8 text-center" }>
								NO MESSAGES YET
							</p>
						) }
						<AnimatePresence initial={ false } mode={ "popLayout" }>
							{ messages.map( message => (
								<ChatBubble
									key={ message.id }
									message={ message }
									isOwn={ message.author.id === authInfo?.id }
								/>
							) ) }
						</AnimatePresence>
					</div>

					<div className={ "flex flex-col gap-2 p-4 border-t border-black shrink-0" }>
						{ policy?.reactions && (
							<div className={ "flex flex-wrap gap-1.5 justify-center" }>
								{ REACTIONS.map( reaction => (
									<button
										key={ reaction.key }
										type={ "button" }
										title={ reaction.label }
										disabled={ isSending }
										onClick={ () => send( ChatReaction.make( { key: reaction.key } ) ) }
										className={ cn(
											"text-xl md:text-2xl leading-none p-1.5 rounded-md",
											"bg-background hover:bg-accent/30 transition-colors",
											"cursor-pointer disabled:opacity-50"
										) }
									>
										{ reaction.glyph }
									</button>
								) ) }
							</div>
						) }

						{ policy?.text && (
							<form className={ "flex gap-2 items-center" } onSubmit={ submitText }>
								<Input
									value={ draft }
									maxLength={ MAX_MESSAGE_LENGTH }
									placeholder={ "Say something…" }
									onChange={ event => setDraft( event.target.value ) }
								/>
								<Button type={ "submit" } disabled={ isSending || !draft.trim() }>
									SEND
								</Button>
							</form>
						) }
						{ policy && !policy.text && (
							<p className={ "text-xs text-center opacity-60" }>
								TEXT CHAT IS OFF FOR THIS GAME — REACTIONS ONLY
							</p>
						) }
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

function ChatBubble( { message, isOwn }: { message: ChatMessage; isOwn: boolean } ) {
	const firstName = message.author.name.split( " " )[ 0 ].toUpperCase();
	// Bound to a const so the narrowing survives into the `find` callback.
	const body = message.body;
	const glyph = body._tag === "chat/Reaction"
		? REACTIONS.find( r => r.key === body.key )?.glyph
		: undefined;

	return (
		<motion.div
			layout
			initial={ { opacity: 0, scale: 0.7 } }
			animate={ {
				opacity: 1,
				scale: 1,
				transition: { type: "spring", stiffness: 380, damping: 22 }
			} }
			exit={ { opacity: 0, scale: 0.7, transition: { duration: 0.2 } } }
			className={ cn( "flex gap-2 items-end max-w-full", isOwn && "flex-row-reverse" ) }
		>
			<img
				src={ message.author.avatar }
				alt={ "" }
				className={ "w-6 h-6 md:w-8 md:h-8 rounded-full bg-background shrink-0" }
			/>
			<div
				className={ cn(
					"flex flex-col gap-0.5 min-w-0",
					isOwn ? "items-end" : "items-start"
				) }
			>
				{ !isOwn && (
					<span className={ "text-[10px] opacity-60 px-1" }>{ firstName }</span>
				) }
				{ body._tag === "chat/Text" ? (
					<div
						className={ cn(
							"px-3 py-2 max-w-full border-2 border-black",
							"text-xs md:text-sm break-words whitespace-pre-wrap",
							isOwn
								? "bg-accent text-neutral-dark rounded-2xl rounded-br-sm"
								: "bg-background text-foreground rounded-2xl rounded-bl-sm"
						) }
					>
						{ body.text }
					</div>
				) : (
					// A reaction is the message — a bubble around it would only shrink it.
					<span className={ "text-3xl md:text-4xl leading-none px-1" }>{ glyph }</span>
				) }
			</div>
		</motion.div>
	);
}
