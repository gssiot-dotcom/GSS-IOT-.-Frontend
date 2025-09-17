import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IAngleNode, IGateway } from '@/types/interfaces'
import axios from 'axios'
import { Edit2, Upload } from 'lucide-react'
import React, { useRef, useState } from 'react'
import { GatewaysEditModal, NodesEditModal } from './productEdit'
// const imageBasUrl = `${import.meta.env.VITE_SERVER_BASE_URL}/static/images/`
const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL
interface IProps2 {
	building?: {
		_id: string
		building_name?: string
		nodes_position_file?: string
		building_plan_img?: string
	}
	gateways: IGateway[]
	angle_nodes: IAngleNode[]
	image_url: string
	isPlanImgOpen: boolean
	togglePlanImg: () => void
}

const ImageModal = ({
	imageUrl,
	onClose,
	buildingName,
}: {
	imageUrl: string
	onClose: () => void
	buildingName?: string
}) => {
	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
			<div className='bg-white p-4 rounded-lg max-w-4xl w-full mx-2'>
				<h3 className='text-lg font-semibold mb-4'>{buildingName}</h3>
				<img src={imageUrl} alt='Building' className='w-full h-auto' />
				<Button onClick={onClose} className='mt-4'>
					닫기
				</Button>
			</div>
		</div>
	)
}

const NodesMultipleButtonsField = ({
	building,
	gateways,
	angle_nodes,
	image_url,
	isPlanImgOpen,
	togglePlanImg,
}: IProps2) => {
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [isNodesModalOpen, setIsNodesModalOpen] = useState(false)
	const [isGwsModalOpen, setIsGwsModalOpen] = useState(false)

	const handleUploadClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click()
		}
	}

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		const formData = new FormData()
		formData.append('image', file)
		formData.append('building_id', String(building?._id))

		try {
			const res = await axios.put(
				`${SERVER_BASE_URL}/company/upload-company-plan`,
				formData
			)

			if (res.status < 200 || res.status >= 300)
				throw new Error('Upload failed')
			alert('Upload success ✅')
		} catch (error) {
			console.log(error)
			alert('Upload failed ❌')
		}
	}

	const handleSaveNodes = (updatedNodes: IAngleNode[]) => {
		console.log('Saving updated nodes:', updatedNodes)
	}

	return (
		<Card className='border-slate-400 mx-auto w-full h-[6vh]'>
			<CardContent className='p-2 h-full flex items-center justify-center'>
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full'>
					{/* Floor Plan Upload (파일 탐색기 열림) */}
					<>
						<input
							type='file'
							accept='image/*'
							className='hidden'
							ref={fileInputRef}
							onChange={handleFileChange}
						/>
						<Button
							variant='outline'
							onClick={handleUploadClick}
							className='flex items-center gap-2 h-auto py-2 border-slate-400'
						>
							<Upload className='w-4 h-4' />
							<span className='text-xs'>도면 업로드</span>
						</Button>
					</>

					{/* Floor Plan View (모달로 이미지 보여주기) */}
					<Button
						variant='outline'
						onClick={() => setIsNodesModalOpen(true)}
						className='flex items-center gap-2 h-auto py-2 border-slate-400'
					>
						<Edit2 className='w-4 h-4' />
						<span className='text-xs'>노드 수정</span>
					</Button>

					{/* Position File Download (파일 다운로드 링크만) */}
					{/* {building?.nodes_position_file && (
						<Button
							variant='outline'
							asChild
							className='flex items-center gap-2 h-auto py-2 border-slate-400'
						>
							<a
								href={`${
									process.env.SERVER_BASE_URL
								}/exels/${encodeURIComponent(building.nodes_position_file)}`}
								download
							>
								<FileText className='w-4 h-4' />
								<span className='text-xs'>위치 파일</span>
								<Download className='w-3 h-3' />
							</a>
						</Button>
					)} */}

					{/* Nodes Report Download (버튼만, 동작 없음) */}
					<Button
						variant='outline'
						onClick={() => setIsGwsModalOpen(true)}
						className='flex items-center gap-2 h-auto py-2 border-slate-400'
					>
						<Edit2 className='w-4 h-4' />
						<span className='text-xs'>게이트웨이 수정</span>
					</Button>
				</div>

				{/* Modal for Floor Plan Image */}
				{isPlanImgOpen && (
					<ImageModal
						imageUrl={image_url}
						buildingName={building?.building_name}
						onClose={() => togglePlanImg()}
					/>
				)}

				{/* Nodes Edit Modal */}
				<NodesEditModal
					isOpen={isNodesModalOpen}
					onClose={() => setIsNodesModalOpen(false)}
					angleNodes={angle_nodes}
					onSave={handleSaveNodes}
				/>

				{/* Gateways Edit Modal */}
				<GatewaysEditModal
					isOpen={isGwsModalOpen}
					onClose={() => setIsGwsModalOpen(false)}
					gatewyas={gateways}
					onSave={() => console.log('Save gateways')}
				/>
			</CardContent>
		</Card>
	)
}
export default NodesMultipleButtonsField
