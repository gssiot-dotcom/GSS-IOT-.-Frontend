/* eslint-disable @typescript-eslint/no-explicit-any */
import nodeImage from '@/assets/node.png'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import TotalcntCsv from '@/dashboard/components/shared-dash/TotalnctCSV'
import { IAngleNode, IBuilding } from '@/types/interfaces'
import { Eye } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NodeDetailModal } from './angleNodeDetail'

interface Props {
	building_angle_nodes: IAngleNode[]
	dangerAngleNodes: IAngleNode[]
	onSelectNode: (doorNum: number) => void
	buildingData?: IBuilding
	B: number
	G: number
	Y: number
	R: number
	setB: (val: number) => void
	setG: (val: number) => void
	setY: (val: number) => void
	setR: (val: number) => void
	viewMode: 'general' | 'delta' | 'avgDelta'
	setViewMode: (mode: 'general' | 'delta' | 'avgDelta') => void
	allNodes: IAngleNode[]
	onSetAlarmLevels: (levels: {
		B: number
		G: number
		Y: number
		R: number
	}) => void
}

const AngleNodeScroll = ({
	building_angle_nodes,
	dangerAngleNodes,
	onSelectNode,
	buildingData,
	B,
	G,
	Y,
	R,
	setB,
	setG,
	setY,
	setR,
	viewMode,
	setViewMode,
	onSetAlarmLevels,
}: Props) => {
	const [selectedGateway, setSelectedGateway] = useState<string>('')
	const [selectedNode, setSelectedNode] = useState<number | ''>('')
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [selectedNodeForModal, setSelectedNodeForModal] = useState<any>(null)

	// added constant for sorting and color logic: Yusuf
	const LIMIT = 10
	const sortedNodes = useMemo(() => {
		if (!building_angle_nodes?.length) return []
		return [...building_angle_nodes].sort((a, b) => {
			const aOver = Math.abs(a.angle_x) > LIMIT
			const bOver = Math.abs(b.angle_x) > LIMIT
			if (aOver !== bOver) return aOver ? 1 : -1 // >10 lar pastga
			return Math.abs(b.angle_x) - Math.abs(a.angle_x) // bir xil guruh ichida desc
		})
	}, [building_angle_nodes])

	const gateways = useMemo(() => {
		const set = new Set<string>()
		building_angle_nodes.forEach(node => {
			if (node.gateway_id?.serial_number) set.add(node.gateway_id.serial_number)
		})
		return Array.from(set).sort()
	}, [building_angle_nodes])

	const nodesToDisplay = useMemo(() => {
		let nodes = [...sortedNodes]
		if (selectedGateway) {
			nodes = nodes.filter(
				node => node.gateway_id?.serial_number === selectedGateway
			)
		}
		if (selectedNode !== '') {
			nodes = nodes.filter(node => node.doorNum === selectedNode)
		}
		return nodes
	}, [sortedNodes, selectedGateway, selectedNode])

	// 노드 카드 색상 결정 함수: added LIMIT constant: Yusuf
	const getNodeColorClass = (x: number) => {
		// 1) |x| > 10 bo'lsa hamisha blue qaytaramiz
		if (Math.abs(x) > LIMIT) {
			return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
		}

		// 2) Quyidagi ranglar faqat [-10, 10] oralig'ida ishlaydi
		if (B === 0 && G === 0 && Y === 0 && R === 0)
			return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'

		if (x <= -R || x >= R)
			return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'

		if ((x <= -Y && x > -R) || (x >= Y && x < R))
			return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'

		if ((x <= -G && x > -Y) || (x >= G && x < Y))
			return 'bg-gradient-to-r from-yellow-50 to-yellow-200 hover:to-yellow-300'

		if ((x <= -B && x > -G) || (x >= B && x < G))
			return 'bg-gradient-to-r from-green-50 to-green-200 hover:to-green-300'

		if (x > -B && x < B)
			return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'

		return 'bg-gray-100'
	}

	const generateOptions = (min: number) => {
		return Array.from({ length: 21 }, (_, i) =>
			Number.parseFloat((i * 0.5).toFixed(1))
		).filter(num => num >= min)
	}

	const handleNodeCardClick = (node: any) => {
		onSelectNode(node.doorNum)
	}

	const handleNodeDetailClick = (e: React.MouseEvent, node: any) => {
		e.stopPropagation() // Prevent card click event
		setSelectedNodeForModal(node)
		setIsModalOpen(true)
	}

	return (
		<div className='grid grid-cols-12 gap-4 w-full h-screen px-4 py-4'>
			<ScrollArea className='col-span-12 md:col-span-4 overflow-auto h-full rounded-lg border border-slate-400 bg-white p-4 -mt-5 2xl:h-[95vh] w-[90%]'>
				{/* BGYR 설정 & 알람 저장 */}
				<div className='flex justify-between mb-4 gap-2 items-end'>
					{[
						{
							key: 'B',
							label: '정상',
							color: 'bg-blue-500',
							setter: setB,
							value: B,
						},
						{
							key: 'G',
							label: '안전',
							color: 'bg-green-500',
							setter: setG,
							value: G,
						},
						{
							key: 'Y',
							label: '경고',
							color: 'bg-yellow-400',
							setter: setY,
							value: Y,
						},
						{
							key: 'R',
							label: '위험',
							color: 'bg-red-500',
							setter: setR,
							value: R,
						},
					].map(({ key, label, color, setter, value }) => {
						const minValue =
							key === 'B' ? 0 : key === 'G' ? B : key === 'Y' ? G : Y
						return (
							<div key={key} className='flex flex-col items-center'>
								<label className='flex items-center text-xs font-semibold mb-1 gap-1'>
									<span
										className={`w-3 h-3 ${color} inline-block rounded-sm`}
									></span>
									{label}
								</label>
								<select
									className='border border-gray-300 rounded-md px-2 py-1 text-sm'
									value={value}
									onChange={e => setter(Number.parseFloat(e.target.value))}
								>
									{generateOptions(minValue).map(num => (
										<option key={num} value={num}>
											{num}
										</option>
									))}
								</select>
							</div>
						)
					})}
					{/* 알람 저장 버튼 */}
					<button
						className='px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors'
						onClick={() => onSetAlarmLevels({ B, G, Y, R })}
					>
						<p>알람</p>
						<p>저장</p>
					</button>
				</div>

				{/* 뷰 모드 */}
				<div className='flex justify-center mb-4 gap-2'>
					<button
						className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${
							viewMode === 'general'
								? 'bg-blue-600'
								: 'bg-gray-400 hover:bg-gray-500'
						}`}
						onClick={() => setViewMode('general')}
					>
						기울기
					</button>
					<button
						className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${
							viewMode === 'delta'
								? 'bg-purple-600'
								: 'bg-gray-400 hover:bg-gray-500'
						}`}
						onClick={() => setViewMode('delta')}
					>
						변화량
					</button>
					<button
						className={`px-3 py-1 rounded-lg font-bold text-xs text-white transition-colors duration-200 ${
							viewMode === 'avgDelta'
								? 'bg-green-600'
								: 'bg-gray-400 hover:bg-gray-500'
						}`}
						onClick={() => setViewMode('avgDelta')}
					>
						평균변화
					</button>
				</div>

				{/* Gateway + Node 선택 */}
				<div className='flex justify-center mb-4 gap-1 flex-nowrap'>
					<span className='text-xs font-semibold'>구역설정 :</span>
					<select
						className='border border-gray-300 rounded-md px-1 py-0.5 text-xs overflow-y-auto'
						value={selectedGateway}
						onChange={e => setSelectedGateway(e.target.value)}
					>
						<option value=''>전체 구역</option>
						{gateways.map(gw => (
							<option key={gw} value={gw}>
								{gw}
							</option>
						))}
					</select>
					<span className='text-xs font-semibold'>노드설정 :</span>
					<select
						className='border border-gray-300 rounded-md px-1 py-0.5 text-xs overflow-y-auto'
						value={selectedNode}
						onChange={e =>
							setSelectedNode(
								e.target.value === '' ? '' : Number.parseInt(e.target.value)
							)
						}
					>
						<option value=''>전체 노드</option>
						{[...sortedNodes]
							.sort((a, b) => a.doorNum - b.doorNum)
							.map(node => (
								<option key={node.doorNum} value={node.doorNum}>
									{node.doorNum}
								</option>
							))}
					</select>
				</div>

				{/* 노드 카드 */}
				<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
					{nodesToDisplay.map(item => {
						return (
							<Card
								key={item.doorNum}
								onClick={() => handleNodeCardClick(item)}
								className={`border border-slate-300 flex flex-col justify-center p-2 ${getNodeColorClass(
									item.angle_x
								)} shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer relative`}
							>
								<CardContent className='flex flex-col justify-center p-2 text-sm text-gray-700'>
									<div className='flex justify-between items-center mb-2'>
										<h1 className='font-bold text-blue-700'>노드넘버</h1>
										<span className='text-blue-800 font-semibold text-lg'>
											{item.doorNum}
										</span>
									</div>
									<div className='flex justify-between mb-1'>
										<p className='font-medium text-gray-600'>Axis-X:</p>
										<p className='text-gray-800'>{item.angle_x}</p>
									</div>
									<div className='flex justify-between mb-1'>
										<p className='font-medium text-gray-600'>Axis-Y:</p>
										<p className='text-gray-800'>{item.angle_y}</p>
									</div>
									<div className='flex justify-between mb-1'>
										<p className='text-gray-800'>Gateway:</p>
										<p className='font-medium text-gray-600'>
											{item.gateway_id?.serial_number || 'N/A'}
										</p>
									</div>
									<button
										onClick={e => handleNodeDetailClick(e, item)}
										className='mt-2 w-full flex items-center justify-center gap-2 py-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98]'
									>
										<Eye className='w-4 h-4' />
										<span>상세정보</span>
									</button>
								</CardContent>
							</Card>
						)
					})}
				</div>
			</ScrollArea>

			{/* 중앙: Gateway + 이미지 / CSV */}
			<div className='col-span-12 md:col-span-6 flex flex-col justify-between h-[40%] md:-mt-5 2xl:-mt-5'>
				{/* 위쪽: 게이트웨이 + 이미지 */}
				<div className='flex flex-row items-start justify-end gap-6 mb-4 w-full'>
					{/* Gateway 박스 */}
					<div className='flex flex-col items-center w-[20.5vw] h-[30vh] border border-slate-300 rounded-md bg-gray-50 text-gray-600 p-2'>
						<ScrollArea className='h-full w-full'>
							<div className='grid grid-cols-3 gap-2 w-full'>
								{gateways.map((gw, index) => {
									const nodeCount = building_angle_nodes.filter(
										node => node.gateway_id?.serial_number === gw
									).length
									return (
										<div
											key={index}
											className='bg-blue-500 text-white text-sm font-semibold p-2 rounded-md flex flex-col items-center justify-center shadow-md'
										>
											<span className='truncate'>{gw}</span>
											<span className='text-xs mt-1'>노드: {nodeCount}</span>
										</div>
									)
								})}
							</div>
						</ScrollArea>
					</div>

					{/* 비계전도노드 이미지 */}
					<div className='flex flex-col items-center'>
						<img
							src={`${import.meta.env.VITE_SERVER_BASE_URL}/static/images/${
								buildingData?.building_plan_img || nodeImage
							}`}
							alt='비계전도 노드'
							className='w-[19.5vw] h-auto object-contain rounded-md'
						/>
					</div>
				</div>

				{/* 아래쪽: CSV */}
				<div className='w-full flex justify-center'>
					<div className='w-full max-w-[100%]'>
						<TotalcntCsv building={buildingData} />
					</div>
				</div>
			</div>

			{/* 위험 노드 표시 */}
			<ScrollArea
				className='col-span-12 md:col-span-2 overflow-auto rounded-lg border border-slate-400 bg-white p-3 -mt-5'
				style={{ height: '40%', width: '109%' }}
			>
				<div className='flex flex-col gap-2'>
					{dangerAngleNodes && dangerAngleNodes.length ? (
						dangerAngleNodes.map(item => (
							<div
								key={item._id}
								className='text-center p-2 bg-red-500 border rounded-md'
							>
								<p className='text-white text-[16px]'>
									노드 {item.doorNum}번 경고
								</p>
							</div>
						))
					) : (
						<div className='p-2 bg-blue-500 border rounded-md'>
							<p className='text-center text-white text-[16px]'>
								지금 위험이 없습니다.
							</p>
						</div>
					)}
				</div>
			</ScrollArea>

			{/* Node Detail Modal */}
			<NodeDetailModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				node={selectedNodeForModal}
			/>
		</div>
	)
}

export default AngleNodeScroll
