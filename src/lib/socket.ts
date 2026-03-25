import { io, Socket } from 'socket.io-client'

const apiBase = import.meta.env.VITE_SERVER_BASE_URL as string
const socketBase = apiBase.replace(/\/api\/?$/, '')

export type NodeType = 'node' | 'angle' | 'vertical'

export const socket: Socket = io(socketBase, {
	transports: ['websocket'],
	autoConnect: false,
	// agar cookie/session bilan auth bo‘lsa:
	// withCredentials: true,
	//
	// agar token bilan auth bo‘lsa:
	// auth: {
	//   token: localStorage.getItem('accessToken') ?? '',
	// },
})

export function ensureSocketConnected() {
	if (!socket.connected) {
		socket.connect()
	}
}
