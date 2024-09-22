import { Button, Spinner } from "@base/components";
import { client } from "@stairway/clients/literature";
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
		<Button onClick={ () => mutate( { playerCount: 6 } ) } disabled={ isPending }>
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
		<Button onClick={ () => mutate( { code } ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "JOIN GAME" }
		</Button>
	);
}

export const AddBots = ( { gameId }: GameIdProps ) => {
	const { mutate, isPending } = useMutation( {
		mutationFn: client.addBots.mutate
	} );

	return (
		<Button onClick={ () => mutate( { gameId } ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
};

export type CreateTeamsProps = GameIdProps & {
	data: Record<string, string[]>;
	onSubmit: () => void;
}

export function CreateTeams( { gameId, data, onSubmit }: CreateTeamsProps ) {
	const { mutate, isPending } = useMutation( {
		mutationFn: client.createTeams.mutate,
		onSuccess: () => onSubmit()
	} );

	return (
		<Button onClick={ () => mutate( { gameId, data } ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "CREATE TEAMS" }
		</Button>
	);
}

export const StartGame = ( { gameId }: GameIdProps ) => {
	const { mutate, isPending } = useMutation( {
		mutationFn: client.startGame.mutate
	} );

	return (
		<Button onClick={ () => mutate( { gameId } ) } disabled={ isPending }>
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
		<Button onClick={ () => mutate( { gameId } ) } disabled={ isPending }>
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
		<Button onClick={ () => mutate( { gameId, card, from } ) } disabled={ isPending }>
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
		<Button onClick={ () => mutate( { gameId, data } ) } disabled={ isPending }>
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