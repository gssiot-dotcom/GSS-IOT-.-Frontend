import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { IAngleNode } from '@/types/interfaces'
import axios from 'axios'
import { Download, Edit2, FileText, Save, Upload, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
const imageBasUrl = `${import.meta.env.VITE_SERVER_BASE_URL}/static/images/`
const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL
interface IProps2 {
	building?: {
		_id: string
		building_name?: string
		nodes_position_file?: string
		building_plan_img?: string
	}
	angle_nodes: IAngleNode[]
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
	angle_nodes,
	isPlanImgOpen,
	togglePlanImg,
}: IProps2) => {
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [isNodesModalOpen, setIsNodesModalOpen] = useState(false)

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
					{building?.nodes_position_file && (
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
					)}

					{/* Nodes Report Download (버튼만, 동작 없음) */}
					<Button
						variant='outline'
						className='flex items-center gap-2 h-auto py-2 border-slate-400'
					>
						<FileText className='w-4 h-4' />
						<span className='text-xs'>현장 노드 리포트</span>
					</Button>
				</div>

				{/* Modal for Floor Plan Image */}
				{isPlanImgOpen && (
					<ImageModal
						imageUrl={imageBasUrl + building?.building_plan_img}
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
			</CardContent>
		</Card>
	)
}
export default NodesMultipleButtonsField

// ============================ Nodes Edit Modal =============================
interface NodesEditModalProps {
	isOpen: boolean
	onClose: () => void
	angleNodes: IAngleNode[]
	onSave: (updatedNodes: IAngleNode[]) => void
}

export const NodesEditModal = ({
	isOpen,
	onClose,
	angleNodes,
	onSave,
}: NodesEditModalProps) => {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editedNodes, setEditedNodes] = useState<IAngleNode[]>(angleNodes)
	const [uploadedFiles, setUploadedFiles] = useState<
		Record<string, File | null>
	>({})

	const [previews, setPreviews] = useState<Record<string, string>>({})
	const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
	useEffect(() => {
		setEditedNodes(angleNodes)
	}, [angleNodes])

	if (!isOpen) return null

	const handleEdit = (nodeId: string) => setEditingId(nodeId)

	const handleSave = async (nodeId: string) => {
		const nodeToSave = editedNodes.find(n => n._id === nodeId)
		if (!nodeToSave) return

		try {
			const fd = new FormData()
			fd.append('node_position', nodeToSave.position ?? '')

			const file = uploadedFiles[nodeId]
			if (file) {
				// backend: node_image — fayl field nomi
				fd.append('image', file, file.name)
			}
			// Eslatma: fayl yo‘q bo‘lsa umuman node_image append qilmaymiz

			const response = await axios.put(
				`${SERVER_BASE_URL}/product/angle-node/${nodeId}`,
				fd,
				{
					headers: {
						'Content-Type': 'multipart/form-data',
					},
				}
			)

			if (response.status >= 200 && response.status < 300) {
				// tozalash
				setEditingId(null)

				// objectURL ni tozalash
				const url = previews[nodeId]
				if (url) URL.revokeObjectURL(url)

				setPreviews(prev => {
					const copy = { ...prev }
					delete copy[nodeId]
					return copy
				})
				setUploadedFiles(prev => {
					const copy = { ...prev }
					delete copy[nodeId]
					return copy
				})

				// serverdan qaytgan yangi path bo‘lsa, local statega yozib qo‘ying (ixtiyoriy)
				const updatedPath = response.data?.angle_node_img
				if (updatedPath) {
					setEditedNodes(prev =>
						prev.map(n =>
							n._id === nodeId ? { ...n, angle_node_img: updatedPath } : n
						)
					)
				}
			} else {
				console.error('Failed to save node')
			}
		} catch (e) {
			console.error('Error saving node:', e)
		}
	}

	const handleCancelAll = () => {
		// objectURL larni revoke qilish
		Object.values(previews).forEach(url => {
			try {
				URL.revokeObjectURL(url)
			} catch {
				/* ignore errors */
			}
		})
		setPreviews({})
		setUploadedFiles({})
		setEditedNodes(angleNodes)
		setEditingId(null)
		Object.values(fileInputRefs.current).forEach(input => {
			if (input) input.value = ''
		})
	}

	const handleInputChange = (
		nodeId: string,
		field: 'position' | 'angle_node_img',
		value: string
	) => {
		setEditedNodes(prev =>
			prev.map(node =>
				node._id === nodeId ? { ...node, [field]: value } : node
			)
		)
	}

	const handleFileUpload = (
		nodeId: string,
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		const file = e.target.files?.[0]
		if (!file) return
		// Faylni saqlaymiz
		setUploadedFiles(prev => ({ ...prev, [nodeId]: file }))
		// Preview uchun object URL
		const url = URL.createObjectURL(file)
		setPreviews(prev => ({ ...prev, [nodeId]: url }))
		// (ixtiyoriy) UI da ko‘rinishi uchun node modeliga ham yozib qo‘ysak bo‘ladi
		setEditedNodes(prev =>
			prev.map(n => (n._id === nodeId ? { ...n, angle_node_img: url } : n))
		)
	}

	const handleImageCancel = (nodeId: string) => {
		// objectURL ni tozalash
		const url = previews[nodeId]
		if (url) URL.revokeObjectURL(url)

		setPreviews(prev => {
			const copy = { ...prev }
			delete copy[nodeId]
			return copy
		})
		setUploadedFiles(prev => {
			const copy = { ...prev }
			delete copy[nodeId]
			return copy
		})

		// inputni tozalash
		const input = fileInputRefs.current[nodeId]
		if (input) input.value = ''

		// UI: preview o‘rniga eski rasm yoki hech narsa
		setEditedNodes(prev =>
			prev.map(n =>
				n._id === nodeId ? { ...n, angle_node_img: n.angle_node_img ?? '' } : n
			)
		)
	}

	const handleSaveAll = () => {
		onSave(editedNodes)
		onClose()
	}

	const getNodeImageSrc = (node: IAngleNode) => {
		if (!node.angle_node_img) return undefined
		// Talab bo‘yicha: mavjud bo‘lsa doim bazaviy URL bilan
		return `${imageBasUrl}/${node.angle_node_img || 'placeholder.svg'}`
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<Card className='w-full max-w-6xl max-h-[90vh] overflow-hidden'>
				<CardHeader className='flex flex-row items-center justify-between'>
					<CardTitle>노드 편집</CardTitle>
					<Button variant='ghost' size='sm' onClick={onClose}>
						<X className='w-4 h-4' />
					</Button>
				</CardHeader>

				<CardContent className='overflow-auto max-h-[70vh]'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Node-Node</TableHead>
								<TableHead>Node Gateway</TableHead>
								<TableHead>Node Zone</TableHead>
								<TableHead>Node Image</TableHead>
								<TableHead className='text-center'>Actions</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{editedNodes.map(node => {
								const isEditing = editingId === node._id
								const selectedPreview = previews[node._id] // data URL bo'lishi mumkin
								const displaySrc = getNodeImageSrc(node)

								return (
									<TableRow key={node._id}>
										<TableCell className='font-medium'>
											{node.doorNum}
										</TableCell>
										<TableCell>{node.gateway_id?.serial_number}</TableCell>

										<TableCell>
											{isEditing ? (
												<Input
													value={node.position || ''}
													onChange={e =>
														handleInputChange(
															node._id,
															'position',
															e.target.value
														)
													}
													className='w-full'
												/>
											) : (
												node.position || 'N/A'
											)}
										</TableCell>

										<TableCell>
											{isEditing ? (
												<div className='flex flex-col gap-2'>
													{!selectedPreview ? (
														// 1) Edit rejimida — avval upload tugmasi
														<div className='flex gap-2 items-center'>
															<Button
																size='sm'
																variant='outline'
																onClick={() =>
																	fileInputRefs.current[node._id]?.click()
																}
																className='flex items-center gap-1'
															>
																<Upload className='w-3 h-3' />
																Upload
															</Button>

															<input
																ref={el =>
																	(fileInputRefs.current[node._id] = el)
																}
																type='file'
																accept='image/*'
																onChange={e => handleFileUpload(node._id, e)}
																className='hidden'
															/>
														</div>
													) : (
														// 2) Fayl tanlanganda — preview + cancel
														<div className='relative inline-block'>
															<img
																src={selectedPreview}
																alt='Node preview'
																className='w-16 h-auto object-cover rounded border bg-white transition-transform duration-200 origin-center hover:scale-[4] relative z-0 hover:z-50 shadow'
															/>
															<Button
																size='icon'
																// variant='outline'
																onClick={() => handleImageCancel(node._id)}
																className='absolute top-0 right-10 h-5 w-5 rounded-full bg-gray-400 text-white hover:bg-gray-600 p-0 flex items-center justify-center'
																title='Cancel image'
															>
																<X className='w-3 h-3' />
															</Button>
														</div>
													)}
												</div>
											) : (
												// View rejimi — rasm bo‘lsa bazaviy URL bilan ko‘rsatamiz
												displaySrc && (
													<div className='relative group'>
														<img
															src={displaySrc}
															alt='Node image'
															className='w-16 h-auto object-cover rounded border bg-white transition-transform duration-200 origin-center hover:scale-[4] relative z-0 hover:z-50 shadow'
														/>
													</div>
												)
											)}
										</TableCell>

										<TableCell>
											<div className='flex gap-2 justify-center'>
												{isEditing ? (
													<>
														<Button
															size='sm'
															onClick={() => handleSave(node._id)}
															className='h-8 w-8 p-0'
															title='Save'
														>
															<Save className='w-3 h-3' />
														</Button>
														<Button
															size='sm'
															variant='outline'
															onClick={handleCancelAll}
															className='h-8 w-8 p-0 bg-transparent'
															title='Cancel all'
														>
															<X className='w-3 h-3' />
														</Button>
													</>
												) : (
													<Button
														size='sm'
														variant='outline'
														onClick={() => handleEdit(node._id)}
														className='h-8 w-8 p-0'
														title='Edit'
													>
														<Edit2 className='w-3 h-3' />
													</Button>
												)}
											</div>
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</CardContent>

				<div className='p-4 border-t flex justify-end gap-2'>
					<Button variant='outline' onClick={onClose}>
						취소
					</Button>
					<Button onClick={handleSaveAll}>모든 변경사항 저장</Button>
				</div>
			</Card>
		</div>
	)
}
