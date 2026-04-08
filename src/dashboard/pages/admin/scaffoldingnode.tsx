'use client'

import FillLoading from '@/components/shared/fill-laoding'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import Totalcnt, {
	NodesMultipleButtonsField,
} from '@/dashboard/components/shared-dash/Totalnct'
import { useBuildingNodes } from '@/hooks/useClientdata'
import { useRealtimeRoom } from '@/hooks/useRealtime'
import { useBuildingNodesStore } from '@/stores/nodeStore'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { INode } from '../../../types/interfaces'

const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'

const toS3Folder = (name: string) =>
	encodeURIComponent(name).replace(/%20/g, '+')

const buildPlanS3Url = (buildingName?: string) => {
	if (!buildingName) return undefined
	const folder = toS3Folder(buildingName)
	return `${S3_BASE_URL}/${folder}/main-img.jpg`
}

const BuildingNodes = () => {
	const { building, nodes, updateNode } = useBuildingNodesStore()
	const [filteredNodes, setFilteredNodes] = useState<INode[]>(nodes || [])
	const [selectedNode, setSelectedNode] = useState<INode | null>(null)
	const [planImgError, setPlanImgError] = useState(false)
	const { buildingId } = useParams()

	if (!buildingId) {
		throw new Error('Building ID is missing')
	}

	const { isLoading } = useBuildingNodes(buildingId)

	const handleNodeRealtime = useCallback(
		(updatedNode: INode) => {
			console.log('Socket node realtime listener is on')
			updateNode(updatedNode)
		},
		[updateNode],
	)

	useRealtimeRoom<INode>({
		buildingId,
		nodeType: 'node',
		enabled: !!buildingId,
		onMessage: handleNodeRealtime,
	})

	useEffect(() => {
		setFilteredNodes(nodes)
	}, [nodes])

	// 선택된 노드가 실시간/재조회로 바뀌면 모달 내용도 같이 최신화
	useEffect(() => {
		if (!selectedNode) return
		const latestNode = nodes.find(node => node._id === selectedNode._id)
		if (latestNode) {
			setSelectedNode(latestNode)
		}
	}, [nodes, selectedNode])

	const handleFilterChange = (filterOpenDoors: boolean) => {
		if (filterOpenDoors) {
			setFilteredNodes(nodes.filter(node => node.doorChk === 1))
		} else {
			setFilteredNodes(nodes)
		}
	}

	const getBatteryIconAndPercentage = (batteryLevel: number) => {
		let color
		let percentage

		switch (true) {
			case batteryLevel >= 39:
				color = 'bg-blue-400'
				percentage = '100%'
				break
			case batteryLevel >= 38:
				color = 'bg-blue-400'
				percentage = '87%'
				break
			case batteryLevel >= 37:
				color = 'bg-blue-400'
				percentage = '74%'
				break
			case batteryLevel >= 36:
				color = 'bg-blue-400'
				percentage = '68%'
				break
			case batteryLevel >= 35:
				color = 'bg-blue-400'
				percentage = '55%'
				break
			case batteryLevel >= 34:
				color = 'bg-blue-400'
				percentage = '50%'
				break
			case batteryLevel >= 33:
				color = 'bg-blue-400'
				percentage = '43%'
				break
			case batteryLevel >= 32:
				color = 'bg-blue-400'
				percentage = '32%'
				break
			case batteryLevel >= 31:
				color = 'bg-red-400'
				percentage = '27%'
				break
			case batteryLevel >= 30:
				color = 'bg-red-400'
				percentage = '20%'
				break
			case batteryLevel >= 29:
				color = 'bg-red-500'
				percentage = '10%'
				break
			default:
				color = 'bg-blue-400'
				percentage = '100%'
		}

		return { color, percentage }
	}

	const selectedBuildingName = building?.building_name || ''

	const planImgUrl = useMemo(
		() => buildPlanS3Url(selectedBuildingName),
		[selectedBuildingName],
	)

	// 타입이 확실치 않을 수 있어서 안전하게 대응
	const getGatewayLabel = (node: INode | null) => {
		if (!node) return 'N/A'

		const gateway =
			(node as any)?.gateway_id?.serial_number ||
			(node as any)?.gateway?.serial_number ||
			(node as any)?.gateway_serial_number ||
			(node as any)?.gatewayId?.serial_number ||
			(node as any)?.gateway_id ||
			(node as any)?.gateway

		return gateway || 'N/A'
	}

	if (isLoading) {
		return <FillLoading />
	}

	return (
		<div className='w-full md:p-5 mx-auto'>
			<div className='space-y-6'>
				<div className='w-full'>
					<Totalcnt
						nodes={nodes}
						onFilterChange={handleFilterChange}
						building={building || undefined}
					/>
					<NodesMultipleButtonsField building={building!} />
				</div>

				<ScrollArea className='md:h-[calc(100vh-214px)] h-[calc(100vh-180px)] w-full rounded-lg border border-slate-400'>
					<div className='grid grid-cols-3 md:grid-cols-6 md:gap-4 gap-2 md:p-4 p-2'>
						{filteredNodes?.map((door, index) => {
							const { color, percentage } = getBatteryIconAndPercentage(door.betChk)

							return (
								<Card
									key={door._id}
									onClick={() => {
										setSelectedNode(door)
										setPlanImgError(false)
									}}
									className={`cursor-pointer transition hover:scale-[1.02] ${door.doorChk ? 'bg-red-500 text-white' : 'bg-[#1e3a8a] text-white'
										}`}
								>
									<CardContent className='md:p-4 p-3 relative'>
										<p className='md:w-7 md:h-7 w-5 h-5 flex justify-center items-center rounded-full bg-white border-blue-800 border text-blue-700 absolute -top-1 -left-1 text-sm'>
											{index + 1}
										</p>

										<div className='space-y-2 pt-2'>
											<div className='flex items-center justify-between text-sm md:text-base'>
												<span className='font-medium text-white/80'>노드번호</span>
												<span className='font-semibold text-white'>{door.doorNum}</span>
											</div>

											<div className='flex items-center justify-between text-sm md:text-base'>
												<span className='font-medium text-white/80'>문상태</span>
												<span className='font-semibold text-white'>
													{door.doorChk ? '열림' : '닫힘'}
												</span>
											</div>

											<div className='flex items-center justify-between text-sm md:text-base'>
												<span className='font-medium text-white/80'>설치구간</span>
												<span className='font-semibold text-white text-right ml-2 break-words'>
													{door.position || 'N/A'}
												</span>
											</div>
										</div>

										<div className='mt-4 pt-3 border-t border-white/20'>
											<div className='w-full flex justify-center items-center md:space-x-2 space-x-2'>
												<span className='text-[10px] text-white'>3.7v:</span>
												<div className='flex-1 bg-white/30 rounded-full h-2'>
													<div
														className={`${color} h-full rounded-full`}
														style={{ width: `${percentage}` }}
													></div>
												</div>
												<span className='text-[10px] text-white'>{percentage}</span>
											</div>
										</div>
									</CardContent>
								</Card>
							)
						})}
					</div>
				</ScrollArea>
			</div>

			{selectedNode && (
				<div
					className='fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4'
					onClick={() => setSelectedNode(null)}
				>
					<div
						className='w-full max-w-6xl rounded-xl bg-white shadow-2xl overflow-hidden'
						onClick={e => e.stopPropagation()}
					>
						<div className='flex items-center justify-between border-b px-5 py-4'>
							<div>
								<h2 className='text-xl font-bold text-slate-900'>
									노드 상세 정보
								</h2>
								<p className='text-sm text-slate-500 mt-1'>
									노드 카드 클릭 상세 보기
								</p>
							</div>

							<button
								type='button'
								className='rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50'
								onClick={() => setSelectedNode(null)}
							>
								닫기
							</button>
						</div>

						<div className='grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-0'>
							<div className='border-b lg:border-b-0 lg:border-r p-5 bg-slate-50'>
								<p className='text-sm font-medium text-slate-600 mb-3'>도면</p>

								{!planImgError && planImgUrl ? (
									<img
										src={planImgUrl}
										alt='Building Plan'
										className='w-full max-h-[70vh] rounded-lg border bg-white object-contain'
										onError={() => setPlanImgError(true)}
									/>
								) : (
									<div className='flex h-[420px] w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500'>
										업로드된 도면 이미지가 없습니다.
									</div>
								)}
							</div>

							<div className='p-5'>
								<p className='text-sm font-medium text-slate-600 mb-3'>
									노드 정보
								</p>

								<div className='space-y-3'>
									<div className='rounded-lg border p-4'>
										<p className='text-xs text-slate-500'>노드 넘버</p>
										<p className='mt-1 text-lg font-semibold text-slate-900'>
											{selectedNode.doorNum}
										</p>
									</div>

									<div className='rounded-lg border p-4'>
										<p className='text-xs text-slate-500'>게이트웨이</p>
										<p className='mt-1 text-lg font-semibold text-slate-900 break-all'>
											{getGatewayLabel(selectedNode)}
										</p>
									</div>

									<div className='rounded-lg border p-4'>
										<p className='text-xs text-slate-500'>문 상태</p>
										<p
											className={`mt-1 text-lg font-semibold ${selectedNode.doorChk
												? 'text-red-600'
												: 'text-blue-700'
												}`}
										>
											{selectedNode.doorChk ? '열림' : '닫힘'}
										</p>
									</div>

									<div className='rounded-lg border p-4'>
										<p className='text-xs text-slate-500'>설치 구간</p>
										<p className='mt-1 text-lg font-semibold text-slate-900'>
											{selectedNode.position || 'N/A'}
										</p>
									</div>

									<div className='rounded-lg border p-4'>
										<p className='text-xs text-slate-500'>건물명</p>
										<p className='mt-1 text-base font-medium text-slate-900'>
											{selectedBuildingName || 'N/A'}
										</p>
									</div>
								</div>

								<div className='mt-5 flex justify-end'>
									<button
										type='button'
										className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
										onClick={() => setSelectedNode(null)}
									>
										닫기
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default BuildingNodes