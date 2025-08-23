import digaenode from '@/assets/digaenode.png'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IAngleNode } from '@/types/interfaces'

interface Props {
	building_angle_nodes: IAngleNode[]
	dangerAngleNodes: IAngleNode[]
	onSelectNode: (doorNum: number) => void
}

/**
 * 주어진 IAngleNode의 angle_x 및 angle_y 값에 따라 적절한 Tailwind CSS 배경 그라데이션 클래스를 반환합니다.
 * 위험도가 높은 순서(빨강 > 노랑 > 초록 > 파랑)로 클래스를 결정합니다.
 * @param item - 배경색을 결정할 IAngleNode 객체입니다.
 * @returns 카드에 적용할 Tailwind CSS 클래스 문자열입니다.
 */

const getNodeColorClass = (item: IAngleNode): string => {
	const absX = Math.abs(item.angle_x)
	const absY = Math.abs(item.angle_y)

	// 빨간색: Axis-X 또는 Axis-Y 절대값이 0.6 초과 (가장 위험)
	if (absX > 0.6 || absY > 0.6) {
		return 'bg-gradient-to-r from-red-100 to-red-300 hover:to-red-400'
	}

	// 노란색: Axis-X 또는 Axis-Y 절대값이 0.4 초과 (주의)
	if (absX > 0.4 || absY > 0.4) {
		return 'bg-gradient-to-r from-yellow-50 to-yellow-200 hover:to-yellow-300'
	}

	// 초록색: Axis-X 또는 Axis-Y 절대값이 0.2 초과 (경미한 위험)
	if (absX > 0.2 || absY > 0.2) {
		return 'bg-gradient-to-r from-green-50 to-green-200 hover:to-green-300'
	}

	// 파란색: Axis-X 및 Axis-Y 절대값이 모두 0.2 이하 (정상)
	return 'bg-gradient-to-r from-blue-50 to-blue-200 hover:to-blue-300'
}

const AngleNodeScroll = ({
	building_angle_nodes,
	dangerAngleNodes,
	onSelectNode,
}: Props) => {
	if (!building_angle_nodes?.length) {
		return (
			<div className='w-full py-7 border border-red-500 rounded-lg text-center text-red-500'>
				노드 정보가 없습니다.
			</div>
		)
	}

	// Axis-X 또는 Axis-Y의 절대값이 큰 순서대로 정렬
	const sortedNodes = [...building_angle_nodes].sort((a, b) => {
		const aMaxAbs = Math.max(Math.abs(a.angle_x), Math.abs(a.angle_y))
		const bMaxAbs = Math.max(Math.abs(b.angle_x), Math.abs(b.angle_y))
		return bMaxAbs - aMaxAbs // 내림차순 정렬
	})

	return (
		<div className='flex flex-col'>
			{' '}
			{/* 부모 컨테이너에 flex-col 추가 */}
			{/* 필터링된 노드 및 위험 노드 섹션 */}
			<div className='grid grid-cols-12 w-full h-[33vh] gap-4 order-1'>
				{' '}
				{/* order-1로 먼저 표시 */}
				{/* 일반 노드 목록 스크롤 영역 */}
				<ScrollArea className='md:col-span-9 col-span-12 overflow-auto rounded-lg border border-slate-400 bg-white w-[25vw] h-[96vh]'>
					<div className='grid grid-cols-2 md:gap-6 gap-2 md:p-5 p-2'>
						{sortedNodes.map(item => (
							<Card
								key={item.doorNum}
								onClick={() => onSelectNode(item.doorNum)}
								// getNodeColorClass 함수를 사용하여 동적으로 배경색 클래스 적용
								className={`border border-slate-300 flex flex-col justify-center p-4${getNodeColorClass(
									item
								)} shadow-md hover:shadow-lg transition duration-200 ease-in-out rounded-xl cursor-pointer`}
							>
								<CardContent className='flex flex-col justify-center p-3 text-sm text-gray-700'>
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
									<div className='flex justify-between'>
										<p className='font-medium text-gray-600'>위치:</p>
										<p className='text-gray-800'>{item.position}</p>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</ScrollArea>
				{/* 위험 노드 알림 스크롤 영역 */}
				<ScrollArea className='max-h-[268px] md:col-span-3 col-span-12 overflow-auto w-full rounded-lg border border-slate-400 bg-white'>
					<div className='md:gap-4 gap-2 md:p-4 p-2'>
						{dangerAngleNodes && dangerAngleNodes.length !== 0 ? (
							dangerAngleNodes.map(item => (
								<div
									key={item._id}
									className='text-center p-2 bg-red-500 border rounded-md mb-2'
								>
									<p className='text-white text-[16px]'>
										노드{item.doorNum}번 경고 확인바람
									</p>
								</div>
							))
						) : (
							<div className='p-2 bg-blue-500 border rounded-md mb-2'>
								<p className='text-center text-white text-[16px]'>
									지금 위험이 없습니다.
								</p>
							</div>
						)}
					</div>
				</ScrollArea>
			</div>
			{/* 비계전도노드 섹션 - 마진 제거하여 클릭 문제 해결 */}
			{/* 이전의 mt-[-30vh], mr-[20vw], ml-[27vw] 클래스를 제거하여 요소가 올바르게 배치되도록 함 */}
			<div className='flex flex-col items-center z-50 p-2 mt-[-30vh] mr-[20vw] ml-[27vw] mb-[2.9vh] order-2'>
				{' '}
				{/* order-2로 이전 섹션 아래에 표시 */}
				<img
					src={digaenode}
					alt='디가에 노드 이미지'
					className='w-[10vw] h-[16vh] object-contain rounded-md'
				/>
				<span className='mt-2 text-center text-sm font-semibold text-gray-700'>
					비계전도노드
				</span>
			</div>
		</div>
	)
}

export default AngleNodeScroll
