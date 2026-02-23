// src/dashboard/pages/user/buildingNodes.tsx
'use client'

import { useClientStore } from '@/stores/buildingsStore'
import { useBuildingNodesStore } from '@/stores/nodeStore'
import { useNavigate, useParams } from 'react-router-dom'
import WeatherInfo from './WeatherInfo'

import digaenode from '@/assets/digaenode.png'
import erpendicularnode from '@/assets/erpendicularnode.png'
import scaffoldingnode from '@/assets/scaffoldingnode.png'

const BuildingNodes = () => {
	const { building } = useBuildingNodesStore()
	const { client } = useClientStore()
	const { clientId, buildingId } = useParams()
	const navigate = useNavigate()

	if (!buildingId || !clientId) {
		return (
			<div className="w-full p-5 text-center text-red-600 font-semibold">
				클라이언트/빌딩 ID가 필요합니다.
			</div>
		)
	}

	return (
		<div className="w-full md:p-5 mx-auto">
			{/* 빌딩 제목 */}
			<div className="space-y-6">
				{/* 모바일: 왼쪽 / md+: 가운데 */}
				<div className="text-left md:text-center space-y-2 px-4 md:px-0">
					<h1 className="md:text-2xl text-lg md:font-bold font-semibold text-gray-700">
						{client?.client_name} building-{building?.building_num}
					</h1>
				</div>
			</div>

			{/* 날씨 */}
			<div className="-mt-9">
				<WeatherInfo buildingId={buildingId} />
			</div>

			{/* 노드 선택 카드 */}
			<div className="ml-4 mr-4 mt-4 
                flex flex-col md:flex-row 
                justify-center items-stretch 
                space-y-4 md:space-y-0 md:space-x-4
                md:h-[calc(100dvh-280px)]">
				{/* 비계 전도 노드 */}
				<div
					className="p-5 w-full md:w-1/3 
           flex flex-col 
           items-center 
           gap-y-6 
           bg-white rounded-xl shadow-lg shadow-gray-200 
           cursor-pointer hover:shadow-gray-400 
           border border-slate-400 duration-200 text-blue-600
           md:h-full"
					onClick={() => navigate('angle-nodes')}
				>
					<div className="w-full flex-1 flex justify-center items-center">
						<img
							src={digaenode}
							alt="비계 전도 노드"
							className="w-full object-contain
               max-h-[260px] 
               md:max-h-[380px]"
						/>
					</div>
					<h1 className="text-lg md:text-xl font-bold text-center">
						비계 전도 노드 보러가기
					</h1>
				</div>

				{/* 해체 발판 노드 */}
				<div
					className="p-5 w-full md:w-1/3 
           flex flex-col 
           items-center 
           gap-y-6 
           bg-white rounded-xl shadow-lg shadow-gray-200 
           cursor-pointer hover:shadow-gray-400 
           border border-slate-400 duration-200 text-blue-600
           md:h-full"
					onClick={() => navigate('scaffolding-nodes')}
				>
					<div className="w-full flex-1 flex justify-center items-center">
						<img
							src={scaffoldingnode}
							alt="해치 발판 노드"
							className="w-full object-contain
               max-h-[260px] 
               md:max-h-[380px]"
						/>
					</div>
					<h1 className="text-lg md:text-xl font-bold text-center">
						해체 발판 노드 보러가기
					</h1>
				</div>

				{/* 수직 노드 */}
				<div
					className="p-5 w-full md:w-1/3 
           flex flex-col 
           items-center 
           gap-y-6 
           bg-white rounded-xl shadow-lg shadow-gray-200 
           cursor-pointer hover:shadow-gray-400 
           border border-slate-400 duration-200 text-blue-600
          	md:h-full"
					onClick={() => navigate('vertical-nodes')}
				>
					<div className="w-full flex-1 flex justify-center items-center">
						<img
							src={erpendicularnode}
							alt="수직 노드"
							className="w-full object-contain
               					max-h-[260px] 
               					md:max-h-[380px]"
						/>
					</div>
					<h1 className="text-lg md:text-xl font-bold text-center">
						수직 노드 보러가기
					</h1>
				</div>
			</div>
		</div>
	)
}

export default BuildingNodes