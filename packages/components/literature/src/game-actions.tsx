import { Button, Spinner } from "@base/components";
import { literature } from "@stairway/clients/literature";

type GameIdProps = { gameId: string };

export function CreateGame( props: { navigate: ( gameId: string ) => Promise<void> } ) {
	const { isPending, mutate } = literature.useCreateGameMutation(
		( { id: gameId } ) => props.navigate( gameId )
	);

	return (
		<Button onClick={ () => mutate( {} ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}

export function JoinGame( props: { code: string, navigate: ( gameId: string ) => Promise<void> } ) {
	const { isPending, mutate } = literature.useJoinGameMutation(
		( { id: gameId } ) => props.navigate( gameId )
	);

	return (
		<Button onClick={ () => mutate( { code: props.code } ) } disabled={ isPending } className={ "w-full" }>
			{ isPending ? <Spinner/> : "JOIN GAME" }
		</Button>
	);
}

export const AddBots = ( { gameId }: GameIdProps ) => {
	const { isPending, mutate } = literature.useAddBotsMutation();

	return (
		<Button onClick={ () => mutate( { gameId } ) } disabled={ isPending } className={ "flex-1 max-w-lg" }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
};

export type CreateTeamsProps = GameIdProps & {
	playerCount: number;
	data: Record<string, string[]>;
	onSubmit: () => void;
}

export function CreateTeams( { data, onSubmit, playerCount, gameId }: CreateTeamsProps ) {
	const { isPending, mutate } = literature.useCreateTeamsMutation(
		async () => onSubmit()
	);

	const isDisabled = isPending
		|| Object.keys( data ).length !== 2
		|| Object.values( data ).flat().length !== playerCount;

	return (
		<Button onClick={ () => mutate( { gameId, data } ) } disabled={ isDisabled } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "CREATE TEAMS" }
		</Button>
	);
}

export const StartGame = ( { gameId }: GameIdProps ) => {
	const { isPending, mutate } = literature.useStartGameMutation();

	return (
		<Button onClick={ () => mutate( { gameId } ) } disabled={ isPending } className={ "flex-1 max-w-lg" }>
			{ isPending ? <Spinner/> : "START GAME" }
		</Button>
	);
};

export const ExecuteBotMove = ( { gameId }: GameIdProps ) => {
	const { isPending, mutate } = literature.useExecuteBotMoveMutation();

	return (
		<Button onClick={ () => mutate( { gameId } ) } disabled={ isPending } className={ "flex-1 max-w-lg" }>
			{ isPending ? <Spinner/> : "EXECUTE BOT MOVE" }
		</Button>
	);
};

export type AskCardProps = GameIdProps & {
	from: string;
	card: string;
	onSubmit: () => void;
}

export function AskCard( { onSubmit, from, card, gameId }: AskCardProps ) {
	const { isPending, mutate } = literature.useAskCardMutation(
		async () => onSubmit()
	);

	return (
		<Button onClick={ () => mutate( { gameId, from, card } ) } disabled={ isPending } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "ASK CARD" }
		</Button>
	);
}

export type CallSetProps = GameIdProps & {
	data: Record<string, string>;
	onSubmit: () => void;
}

export function CallSet( { onSubmit, data, gameId }: CallSetProps ) {
	const { isPending, mutate } = literature.useCallSetMutation(
		async () => onSubmit()
	);

	return (
		<Button onClick={ () => mutate( { gameId, data } ) } disabled={ isPending } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "CALL SET" }
		</Button>
	);
}

export type TransferTurnProps = GameIdProps & {
	transferTo: string;
	onSubmit: () => void;
}

export function TransferTurn( { onSubmit, gameId, transferTo }: TransferTurnProps ) {
	const { isPending, mutate } = literature.useTransferTurnMutation(
		async () => onSubmit()
	);

	return (
		<Button onClick={ () => mutate( { gameId, transferTo } ) } disabled={ isPending } className={ "flex-1" }>
			{ isPending ? <Spinner/> : "TRANSFER TURN" }
		</Button>
	);
}