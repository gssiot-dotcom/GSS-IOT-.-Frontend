// src/dashboard/pages/user/buildingNodes.tsx
'use client'

import socket from '@/hooks/useSocket'
import { useClientStore } from '@/stores/buildingsStore'
import { useBuildingNodesStore } from '@/stores/nodeStore'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { INode } from '../../../types/interfaces'
import WeatherInfo from './WeatherInfo'

import digaenode from '@/assets/digaenode.png'
import erpendicularnode from '@/assets/erpendicularnode.png'
import scaffoldingnode from '@/assets/scaffoldingnode.png'

const BuildingNodes = () => {
	const { building, updateNode } = useBuildingNodesStore()
	const { client } = useClientStore()
	const { clientId, buildingId } = useParams()
	const navigate = useNavigate()

	if (!buildingId || !clientId) {
		return (
			<div className='w-full p-5 text-center text-red-600 font-semibold'>
				클라이언트/빌딩 ID가 필요합니다.
			</div>
		)
	}

	// const { isLoading } = useBuildingNodes(buildingId)

	useEffect(() => {
		const topic = `mqtt/building/${buildingId}`
		socket.on(topic, (updatedNode: INode) => {
			updateNode(updatedNode)
		})
		return () => {
			socket.off(topic)
		}
	}, [buildingId, updateNode])

	// if () return <FillLoading />

	return (
		<div className='w-full md:p-5 mx-auto'>
			{/* 빌딩 제목 */}
			<div className='space-y-6'>
				<div className='text-center space-y-2'>
					<h1 className='md:text-2xl text-lg md:font-bold font-semibold text-gray-700'>
						{client?.client_name} building-{building?.building_num}
					</h1>
				</div>
			</div>

			{/* 날씨 */}
			<div className='-mt-9'>
				<WeatherInfo buildingId={buildingId} />
			</div>

			{/* 노드 선택 카드 */}
			<div className='ml-4 mr-4 mt-4 flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4'>
				{/* 비계 전도 노드 */}
				<div
					className='p-5 w-full md:w-1/3 aspect-[5/6] flex flex-col justify-center items-center gap-y-10 bg-white rounded-xl shadow-lg shadow-gray-200 cursor-pointer hover:shadow-gray-400 border border-slate-400 duration-200 text-blue-600'
					onClick={() => navigate('angle-nodes')}
				>
					<img
						src={digaenode}
						alt='비계 전도 노드'
						className='w-[17vw] h-[35vh]'
					/>
					<h1 className='text-xl font-bold'>비계 전도 노드 보러가기</h1>
				</div>

				{/* 해체 발판 노드 */}
				<div
					className='p-5 w-full md:w-1/3 aspect-[5/6] flex flex-col justify-center items-center gap-y-10 bg-white rounded-xl shadow-lg shadow-gray-200 cursor-pointer hover:shadow-gray-400 border border-slate-400 duration-200 text-blue-600'
					onClick={() => navigate('scaffolding-nodes')}
				>
					<img
						src={scaffoldingnode}
						alt='해체 발판 노드'
						className='w-[17vw] h-[35vh]'
					/>
					<h1 className='text-xl font-bold'>해체 발판 노드 보러가기</h1>
				</div>

				{/* 수직 노드 */}
				<div
					className='p-5 w-full md:w-1/3 aspect-[5/6] flex flex-col justify-center items-center gap-y-10 bg-white rounded-xl shadow-lg shadow-gray-200 cursor-pointer hover:shadow-gray-400 border border-slate-400 duration-200 text-blue-600'
					onClick={() => navigate('vertical-nodes')}
				>
					<img
						src={erpendicularnode}
						alt='수직 노드'
						className='w-[17vw] h-[35vh]'
					/>
					<h1 className='text-xl font-bold'>수직 노드 보러가기</h1>
				</div>
			</div>
		</div>
	)
}

export default BuildingNodes
