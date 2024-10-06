import { Button, Spinner } from "@base/components";
import { client } from "@literature/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

type GameIdProps = { gameId: string };

export function CreateGame() {
	const navigate = useNavigate();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.createGame.mutate,
		onSuccess: ( data ) => navigate( { to: "/literature/$gameId", params: { gameId: data.id } } )
	} );

	return (
		<Button
			onClick={ () => mutate( { playerCount: 6 } ) }
			disabled={ isPending }
		>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}

export function JoinGame( { code }: { code: string } ) {
	const navigate = useNavigate();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.joinGame.mutate,
		onSuccess: ( data ) => navigate( { to: "/literature/$gameId", params: { gameId: data.id } } )
	} );

	return (
		<Button
			onClick={ () => mutate( { code } ) }
			disabled={ isPending }
			className={ "w-full" }
		>
			{ isPending ? <Spinner/> : "JOIN GAME" }
		</Button>
	);
}

export const AddBots = ( { gameId }: GameIdProps ) => {
	const { mutate, isPending } = useMutation( {
		mutationFn: client.addBots.mutate
	} );

	return (
		<Button
			onClick={ () => mutate( { gameId } ) }
			disabled={ isPending }
			className={ "flex-1 max-w-lg" }
		>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
};

export type CreateTeamsProps = GameIdProps & {
	playerCount: number;
	data: Record<string, string[]>;
	onSubmit: () => void;
}

export function CreateTeams( { gameId, data, onSubmit, playerCount }: CreateTeamsProps ) {
	const { mutate, isPending } = useMutation( {
		mutationFn: client.createTeams.mutate,
		onSuccess: () => onSubmit()
	} );

	const isDisabled = isPending
		|| Object.keys( data ).length !== 2
		|| Object.values( data ).flat().length !== playerCount;

	return (
		<Button
			onClick={ () => mutate( { gameId, data } ) }
			disabled={ isDisabled }
			className={ "flex-1" }
		>
			{ isPending ? <Spinner/> : "CREATE TEAMS" }
		</Button>
	);
}

export const StartGame = ( { gameId }: GameIdProps ) => {
	const { mutate, isPending } = useMutation( {
		mutationFn: client.startGame.mutate
	} );

	return (
		<Button
			onClick={ () => mutate( { gameId } ) }
			disabled={ isPending }
			className={ "flex-1 max-w-lg" }
		>
			{ isPending ? <Spinner/> : "START GAME" }
		</Button>
	);
};

export const ExecuteBotMove = ( { gameId }: GameIdProps ) => {
	const queryClient = useQueryClient();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.executeBotMove.mutate,
		onSuccess: async () => {
			await queryClient.invalidateQueries();
		}
	} );

	return (
		<Button
			onClick={ () => mutate( { gameId } ) }
			disabled={ isPending }
			className={ "flex-1 max-w-lg" }
		>
			{ isPending ? <Spinner/> : "EXECUTE BOT MOVE" }
		</Button>
	);
};

export type AskCardProps = GameIdProps & {
	from: string;
	card: string;
	onSubmit: () => void;
}

export function AskCard( { gameId, card, from, onSubmit }: AskCardProps ) {
	const queryClient = useQueryClient();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.askCard.mutate,
		onSuccess: async () => {
			await queryClient.invalidateQueries();
			onSubmit();
		}
	} );

	return (
		<Button
			onClick={ () => mutate( { gameId, card, from } ) }
			disabled={ isPending }
			className={ "flex-1" }
		>
			{ isPending ? <Spinner/> : "ASK CARD" }
		</Button>
	);
}

export type CallSetProps = GameIdProps & {
	data: Record<string, string>;
	onSubmit: () => void;
}

export function CallSet( { gameId, data, onSubmit }: CallSetProps ) {
	const queryClient = useQueryClient();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.callSet.mutate,
		onSuccess: async () => {
			await queryClient.invalidateQueries();
			onSubmit();
		}
	} );

	return (
		<Button
			onClick={ () => mutate( { gameId, data } ) }
			disabled={ isPending }
			className={ "flex-1" }
		>
			{ isPending ? <Spinner/> : "CALL SET" }
		</Button>
	);
}

export type TransferTurnProps = GameIdProps & {
	transferTo: string;
	onSubmit: () => void;
}

export function TransferTurn( { gameId, transferTo, onSubmit }: TransferTurnProps ) {
	const queryClient = useQueryClient();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.transferTurn.mutate,
		onSuccess: async () => {
			await queryClient.invalidateQueries();
			onSubmit();
		}
	} );

	return (
		<Button onClick={ () => mutate( { gameId, transferTo } ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "TRANSFER TURN" }
		</Button>
	);
}