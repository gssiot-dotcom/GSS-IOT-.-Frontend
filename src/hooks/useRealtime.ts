/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react'
import { ensureSocketConnected, NodeType, socket } from '../lib/socket'

type BuildingId = string | number

interface UseRealtimeRoomParams<T> {
	buildingId?: BuildingId | null
	nodeType: NodeType
	enabled?: boolean
	onMessage: (payload: T) => void
}

export function useRealtimeRoom<T = unknown>({
	buildingId,
	nodeType,
	enabled = true,
	onMessage,
}: UseRealtimeRoomParams<T>) {
	const onMessageRef = useRef(onMessage)

	useEffect(() => {
		onMessageRef.current = onMessage
	}, [onMessage])

	useEffect(() => {
		if (!enabled || !buildingId) return

		ensureSocketConnected()

		const joinPayload = {
			buildingId: String(buildingId),
			nodeType,
		}

		const handleConnect = () => {
			socket.emit('join_realtime', joinPayload)
		}

		const handleRealtime = (payload: any) => {
			// backend payload ichida buildingId/nodeType yuborsa, qo‘shimcha himoya
			if (
				payload?.buildingId &&
				String(payload.buildingId) !== String(buildingId)
			)
				return
			if (payload?.nodeType && payload.nodeType !== nodeType) return

			onMessageRef.current(payload)
		}

		if (socket.connected) {
			socket.emit('join_realtime', joinPayload)
		}

		socket.on('connect', handleConnect)
		socket.on('realtime-data', handleRealtime)

		return () => {
			socket.off('connect', handleConnect)
			socket.off('realtime-data', handleRealtime)

			// Hozirgi backend dizayn bo‘yicha bitta active room deb hisoblayapmiz
			socket.emit('leave_realtime')
		}
	}, [buildingId, nodeType, enabled])
}
