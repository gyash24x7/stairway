import { Button, Spinner } from "@base/components";
import { client } from "@callbreak/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

type GameIdProps = { gameId: string };
type DealIdProps = GameIdProps & { dealId: string };
type RoundIdProps = DealIdProps & { roundId: string };

type CreateGameProps = { trumpSuit: string; dealCount?: 5 | 9 | 13 }

export function CreateGame( { trumpSuit, dealCount = 5 }: CreateGameProps ) {
	const navigate = useNavigate();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.createGame.mutate,
		onSuccess: ( data ) => navigate( { to: "/callbreak/$gameId", params: { gameId: data.id } } )
	} );

	return (
		<Button
			onClick={ () => mutate( { trumpSuit, dealCount } ) }
			disabled={ isPending }
			className={ "w-full" }
		>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}

export function JoinGame( { code }: { code: string } ) {
	const navigate = useNavigate();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.joinGame.mutate,
		onSuccess: ( data ) => navigate( { to: "/callbreak/$gameId", params: { gameId: data.id } } )
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

export function AddBots( { gameId }: { gameId: string } ) {
	const { mutate, isPending } = useMutation( {
		mutationFn: client.addBots.mutate
	} );

	return (
		<Button
			onClick={ () => mutate( { gameId } ) }
			disabled={ isPending }
			className={ "w-full" }
		>
			{ isPending ? <Spinner/> : "ADD BOTS" }
		</Button>
	);
}

export type DeclareDealWinsProps = DealIdProps & {
	wins: number;
	onSubmit: () => void;
}

export function DeclareDealWins( { gameId, dealId, wins, onSubmit }: DeclareDealWinsProps ) {
	const queryClient = useQueryClient();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.declareDealWins.mutate,
		onSuccess: async () => {
			await queryClient.invalidateQueries();
			onSubmit();
		}
	} );

	return (
		<Button
			onClick={ () => mutate( { gameId, wins, dealId } ) }
			disabled={ isPending }
			className={ "flex-1" }
		>
			{ isPending ? <Spinner/> : "DECLARE WINS" }
		</Button>
	);
}

export type PlayCardProps = RoundIdProps & {
	cardId: string;
	onSubmit: () => void;
}

export function PlayCard( { gameId, dealId, roundId, cardId, onSubmit }: PlayCardProps ) {
	const queryClient = useQueryClient();
	const { mutate, isPending } = useMutation( {
		mutationFn: client.playCard.mutate,
		onSuccess: async () => {
			await queryClient.invalidateQueries();
			onSubmit();
		}
	} );

	return (
		<Button onClick={ () => mutate( { gameId, dealId, roundId, cardId } ) } disabled={ isPending }>
			{ isPending ? <Spinner/> : "PLAY CARD" }
		</Button>
	);
}