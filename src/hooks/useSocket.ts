import { io, Socket } from 'socket.io-client'

const apiBase = import.meta.env.VITE_SERVER_BASE_URL as string
const socketBase = apiBase.replace(/\/api\/?$/, '') // oxiridagi /api yoki /api/ ni olib tashlaydi

const socket: Socket = io(socketBase, {
	transports: ['websocket'],
	autoConnect: true,
})

export default socket
