import { Button, Spinner } from "@base/components";
import { callbreak } from "@stairway/clients/callbreak";

type GameIdProps = { gameId: string };
type DealIdProps = GameIdProps & { dealId: string };
type RoundIdProps = DealIdProps & { roundId: string };

type CreateGameProps = {
	trumpSuit: string;
	navigate: ( gameId: string ) => Promise<void>;
	dealCount?: 5 | 9 | 13;
}

export function CreateGame( { trumpSuit, dealCount = 5, navigate }: CreateGameProps ) {
	const { isPending, mutate } = callbreak.useCreateGameMutation(
		( { id: gameId } ) => navigate( gameId )
	);

	return (
		<Button onClick={ () => mutate( { trumpSuit, dealCount } ) } disabled={ isPending } className={ "w-full" }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}

type JoinGameProps = { code: string; navigate: ( gameId: string ) => Promise<void> };

export function JoinGame( { code, navigate }: JoinGameProps ) {
	const { isPending, mutate } = callbreak.useJoinGameMutation(
		( { id: gameId } ) => navigate( gameId )
	);

	return (
		<Button onClick={ () => mutate( { code } ) } disabled={ isPending } className={ "w-full" }>
			{ isPending ? <Spinner/> : "JOIN GAME" }
		</Button>
	);
}

export function AddBots( { gameId }: { gameId: string } ) {
	const { isPending, mutate } = callbreak.useAddBotsMutation();

	return (
		<Button onClick={ () => mutate( { gameId } ) } disabled={ isPending } className={ "w-full" }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}

export type DeclareDealWinsProps = DealIdProps & {
	wins: number;
	onSubmit: () => void;
}

export function DeclareDealWins( { onSubmit, wins, gameId, dealId }: DeclareDealWinsProps ) {
	const { isPending, mutate } = callbreak.useDeclareDealWinsMutation(
		async () => onSubmit()
	);

	return (
		<Button
			onClick={ () => mutate( { wins, gameId, dealId } ) }
			disabled={ isPending }
			className={ "flex-1 max-w-lg" }
		>
			{ isPending ? <Spinner/> : "DECLARE WINS" }
		</Button>
	);
}

export type PlayCardProps = RoundIdProps & {
	cardId: string;
	onSubmit: () => void;
}

export function PlayCard( { onSubmit, cardId, gameId, dealId, roundId }: PlayCardProps ) {
	const { isPending, mutate } = callbreak.usePlayCardMutation(
		async () => onSubmit()
	);

	return (
		<Button
			onClick={ () => mutate( { cardId, gameId, dealId, roundId } ) }
			disabled={ isPending }
			className={ "flex-1 max-w-lg" }
		>
			{ isPending ? <Spinner/> : "PLAY CARD" }
		</Button>
	);
}