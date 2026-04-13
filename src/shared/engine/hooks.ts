import type { MatchId } from "@/shared/engine/types";
import { useEffect, useRef, useState } from "react";

export function useSync<T>( game: string, matchId: MatchId, initialState: T ) {
	const socketUrl = `/sync/${ game }/${ matchId }`;
	const wsRef = useRef<WebSocket>( null );
	const [ state, setState ] = useState( initialState );

	function connect() {
		if ( wsRef.current ) {
			return;
		}

		const ws = new WebSocket( socketUrl );
		wsRef.current = ws;

		ws.onopen = () => {
			console.log( "WebSocket connection established" );
		};

		ws.onmessage = ( event ) => {
			const { data } = JSON.parse( event.data ) as { data: T, message: string };
			setState( data );
		};

		ws.onclose = () => {
			console.log( "WebSocket connection closed" );
			wsRef.current = null;
		};

		ws.onerror = ( error ) => {
			console.error( "WebSocket error:", error );
		};
	}

	useEffect( () => {
		connect();
		return () => {
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, [] );

	return state;
}