// AngleNodes.tsx (전체 수정본, TotalcntCsv import 및 사용 포함)

import AngleNodeScroll from '@/dashboard/components/shared-dash/AngleNodeScroll'
import SensorGraph from '@/dashboard/pages/admin/angleNodegraphic'
import socket from '@/hooks/useSocket'
import { fetchBuildingAngleNodes } from '@/services/apiRequests'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { IAngleNode, IBuilding } from '../../../types/interfaces'

export interface SensorData {
	doorNum: number
	updatedAt: string
	createdAt: string
	angle_x: number
	angle_y: number
}

export interface GraphDataPoint {
	time: string
	angle_x: number
	angle_y: number
}

interface ResQuery {
	state: string
	building: IBuilding
	angle_nodes: IAngleNode[]
}

const AngleNodes = () => {
	const [selectedDoorNum, setSelectedDoorNum] = useState<number | null>(null)
	const [selectedHours, setSelectedHours] = useState<number>(1)
	const [data, setData] = useState<GraphDataPoint[]>([])
	const [isFirstLoad, setIsFirstLoad] = useState(true)
	const { buildingId } = useParams()
	const queryClient = useQueryClient()

	const queryData = useQueries({
		queries: [
			{
				queryKey: ['get-building-angle-nodes', buildingId], // <-- buildingId ni qo‘shdik
				queryFn: () => fetchBuildingAngleNodes(buildingId!),
				enabled: !!buildingId, // buildingId bo‘lganda ishlasin
				retry: 1,
			},
		],
	})

	const buildingData = queryData[0].data?.building

	const buildingAngleNodes =
		(queryData[0].data?.angle_nodes as IAngleNode[]) || []

	const dangerAngleNodes = useMemo(
		() =>
			buildingAngleNodes.filter(it => it.angle_x >= 0.3 || it.angle_x <= -0.3),
		[buildingAngleNodes]
	)

	useEffect(() => {
		if (!isFirstLoad) return
		if (dangerAngleNodes.length) {
			setSelectedDoorNum(dangerAngleNodes[0].doorNum)
			setIsFirstLoad(false)
			return
		}
		if (buildingAngleNodes.length) {
			setSelectedDoorNum(buildingAngleNodes[0].doorNum)
			setIsFirstLoad(false)
		}
	}, [dangerAngleNodes, buildingAngleNodes, isFirstLoad])

	useEffect(() => {
		if (!selectedDoorNum) return
		const now = new Date()
		const from = new Date(
			now.getTime() - selectedHours * 60 * 60 * 1000
		).toISOString()
		const to = now.toISOString()

		axios
			.get<SensorData[]>('/product/angle-node/data', {
				params: { doorNum: selectedDoorNum, from, to },
				baseURL:
					import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005',
			})
			.then(res => {
				const formatted: GraphDataPoint[] = res.data.map(item => ({
					time: new Date(item.createdAt).toLocaleTimeString('ko-KR', {
						hour: '2-digit',
						minute: '2-digit',
						hour12: false,
					}),
					angle_x: item.angle_x,
					angle_y: item.angle_y,
				}))
				setData(formatted)
			})
			.catch(err => console.error('Data fetch error:', err))
	}, [selectedDoorNum, selectedHours])

	useEffect(() => {
		if (!buildingId) return
		const topic = `${buildingId}_angle-nodes`

		const listener = (newData: SensorData) => {
			// 1) KESHNI AYNAN SHU KALITGA YANGILAYMIZ
			console.log('socket data:', newData)
			queryClient.setQueryData<ResQuery>(
				['get-building-angle-nodes', buildingId], // qarang: key ham mos (2-bandga qarang)
				old => {
					if (!old) return old // cache hali bo'lmasa, hech narsa qilmaymiz

					const list = old.angle_nodes ?? []
					let found = false

					const updated = list.map(n => {
						if (n.doorNum === newData.doorNum) {
							found = true
							return {
								...n,
								angle_x: newData.angle_x,
								angle_y: newData.angle_y,
								createdAt: new Date(
									newData.createdAt ?? Date.now()
								).toISOString(),
							}
						}
						return n
					})

					if (!found) {
						// IAngleNode da majburiy maydonlar bo'lsa, ularni to'liq bering
						updated.push({
							_id: crypto.randomUUID(),
							doorNum: newData.doorNum,
							angle_x: newData.angle_x,
							angle_y: newData.angle_y,
							// createdAt: newData.createdAt ?? new Date().toISOString(),
							// position: 'N/A',
							node_status: false, // <-- agar IAngleNode majburiy bo'lsa
						} as IAngleNode)
					}

					// MUHIM: faqat massiv emas, to'liq ResQuery qaytariladi
					return { ...old, angle_nodes: updated }
				}
			)

			// 2) HOZIR TANLANGAN NODE uchun grafikni ham yangilash
			if (selectedDoorNum === newData.doorNum) {
				const point: GraphDataPoint = {
					time: new Date(newData.updatedAt).toLocaleTimeString('ko-KR', {
						hour: '2-digit',
						minute: '2-digit',
						timeZone: 'Asia/Seoul',
						hour12: false,
					}),
					angle_x: newData.angle_x,
					angle_y: newData.angle_y,
				}
				setData(prev => {
					const next = [...prev, point]
					return next.length > 200 ? next.slice(next.length - 200) : next
				})
			}
		}

		socket.on(topic, listener)
		return () => {
			socket.off(topic, listener)
		}
	}, [buildingId, queryClient, selectedDoorNum])

	return (
		<div className='w-full max-h-screen bg-gray-50 p-2 md:p-5'>

			<AngleNodeScroll
				onSelectNode={door => setSelectedDoorNum(door)}
				building_angle_nodes={buildingAngleNodes}
				dangerAngleNodes={dangerAngleNodes}
				buildingData={buildingData}
			/>

			<div className='-mt-[63.5vh]'>
				<SensorGraph
					graphData={data}
					buildingId={buildingId}
					doorNum={selectedDoorNum}
					onSelectTime={setSelectedHours}
					hours={selectedHours}
				/>
			</div>
		</div>
	)
}

export default AngleNodes
