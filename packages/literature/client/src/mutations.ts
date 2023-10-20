import { useMutation } from "@tanstack/react-query";
import { askCard, callSet, createGame, createTeams, joinGame, startGame, transferChance } from "./base";
import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	TransferChanceInput
} from "@literature/data";
import type { ApiResponse, OpOps } from "@s2h/client";

export const useCreateGameMutation = ( options?: OpOps<{ id: string }> ) => useMutation( {
	mutationFn: ( data: CreateGameInput ) => createGame( data ),
	...options
} );

export const useJoinGameMutation = ( options?: OpOps<{ id: string }> ) => useMutation( {
	mutationFn: ( data: JoinGameInput ) => joinGame( data ),
	...options
} );

export const useCreateTeamsMutation = ( id: string, options?: OpOps<ApiResponse> ) => useMutation( {
	mutationFn: ( data: CreateTeamsInput ) => createTeams( id, data ),
	...options
} );

export const useStartGameMutation = ( id: string, options?: OpOps<ApiResponse> ) => useMutation( {
	mutationFn: () => startGame( id ),
	...options
} );

export const useAskCardMutation = ( id: string, options?: OpOps<ApiResponse> ) => useMutation( {
	mutationFn: ( data: AskCardInput ) => askCard( id, data ),
	...options
} );

export const useCallSetMutation = ( id: string, options?: OpOps<ApiResponse> ) => useMutation( {
	mutationFn: ( data: CallSetInput ) => callSet( id, data ),
	...options
} );

export const useTransferChanceMutation = ( id: string, options?: OpOps<ApiResponse> ) => useMutation( {
	mutationFn: ( data: TransferChanceInput ) => transferChance( id, data ),
	...options
} );