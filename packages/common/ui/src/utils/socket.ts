// @ts-ignore
import { io } from "socket.io-client";

export const socket = io( "http://localhost:8001/literature" );