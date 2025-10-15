/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { IAngleNode, IGateway } from '@/types/interfaces'
import axios from 'axios'
import { Edit2, Save, Upload, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

const imageBasUrl = `${import.meta.env.VITE_SERVER_BASE_URL}/static/images/`
const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL

// ✅ S3 기본 URL
const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'
// ✅ 빌딩명 폴더: 공백 -> '+' 로 보정
const toS3Folder = (name: string) => encodeURIComponent(name).replace(/%20/g, '+')
// ✅ 파일명 세그먼트 안전 인코딩
const toKeyPart = (s?: string | number) =>
	s == null ? '' : encodeURIComponent(String(s).trim())

// ============================ 깜빡임 방지 이미지 ============================ //

const PLACEHOLDER = '/no-image.png'
function ImageOnce({
	src,
	alt,
	className,
}: {
	src?: string
	alt?: string
	className?: string
}) {
	const [state, setState] = React.useState<'loading' | 'ok' | 'error'>(
		src ? 'loading' : 'error'
	)
	const [finalSrc, setFinalSrc] = React.useState<string | undefined>(src)

	React.useEffect(() => {
		setFinalSrc(src)
		setState(src ? 'loading' : 'error')
	}, [src])

	if (!finalSrc || state === 'error') {
		return (
			<div className="w-16 h-16 flex items-center justify-center text-[10px] text-gray-400 border rounded bg-white">
				No image
			</div>
		)
	}

	return (
		<div className="relative">
			{state === 'loading' && (
				<div className="w-16 h-16 rounded border bg-gray-100 animate-pulse" />
			)}
			<img
				src={finalSrc}
				alt={alt}
				loading="lazy"
				className={`w-16 h-auto object-cover rounded border bg-white transition-opacity duration-200 ${state === 'loading' ? 'opacity-0' : 'opacity-100'
					} ${className || ''}`}
				onLoad={() => setState('ok')}
				onError={() => {
					setFinalSrc(PLACEHOLDER)
					setState('error')
				}}
			/>
		</div>
	)
}

// ============================ Nodes Edit Modal ============================= //

interface NodesEditModalProps {
	isOpen: boolean
	onClose: () => void
	angleNodes: IAngleNode[]
	onSave: (updatedNodes: IAngleNode[]) => void
	// 🔥 추가: 빌딩명 전달(예: '호계동 현장')
	buildingName?: string
}

export const NodesEditModal = ({
	isOpen,
	onClose,
	angleNodes,
	onSave,
	buildingName,
}: NodesEditModalProps) => {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editedNodes, setEditedNodes] = useState<IAngleNode[]>(angleNodes)
	const [uploadedFiles, setUploadedFiles] = useState<
		Record<string, File | null>
	>({})

	const [previews, setPreviews] = useState<Record<string, string>>({})
	const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

	// // 🔥 확장자 폴백 상태(이제 사용 안 함 — 주석으로 보관)
	// const [errorOnce, setErrorOnce] = useState<Record<string, boolean>>({})
	// const [extMap, setExtMap] = useState<Record<string, 'jpg' | 'png' | 'webp'>>({})

	// 🔍 이미지 뷰어(라이트박스) 상태
	const [viewerSrc, setViewerSrc] = useState<string | null>(null)

	useEffect(() => {
		setEditedNodes(angleNodes)
	}, [angleNodes])

	// Esc로 라이트박스 닫기 (선택)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setViewerSrc(null)
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [])

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
		// (ixtiyoriy) UI da ko‘rinishi uchun node modeliga ham yozib qo‘ysak 보‘iladi
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

		// UI: preview o‘rniga eski rasm yoki hech нarsa
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

	// 기존 서버 저장 경로(옵션)
	const getNodeImageSrc = (node: IAngleNode) => {
		if (!node.angle_node_img) return undefined
		// Talab bo‘yicha: mavjud bo‘lsa doim bazaviy URL bilan
		return `${imageBasUrl}/${node.angle_node_img || 'placeholder.svg'}`
	}

	// 슬래시 제거 + 트림 → 그 다음에 인코딩
	const sanitizePosForFilename = (s?: string) =>
		(s ?? '').trim().replace(/[\/\\]/g, ''); // '/' '\' 제거

	// 🔥 S3 파일명 = 설치구간_게이트웨이시리얼_노드번호.jpg
	const getS3UrlByTriple = (node: IAngleNode, building?: string) => {
		if (!building) return undefined
		const folder = toS3Folder(building)

		const pos = encodeURIComponent(sanitizePosForFilename(node.position)) // ✅ 여기!
		const gw = toKeyPart(node.gateway_id?.serial_number)
		const door = toKeyPart(node.doorNum)

		if (!pos || !gw || !door) return undefined
		const fileBase = `${pos}_${gw}_${door}`
		return `${S3_BASE_URL}/${folder}/${fileBase}.jpg`
	}

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<Card className='w-full max-w-7xl max-h-[90vh] overflow-hidden'>
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
								<TableHead>노드 넘버</TableHead>
								<TableHead>속한 게이트웨이</TableHead>
								<TableHead>설치 구간</TableHead>
								<TableHead>설치된 이미지</TableHead>
								<TableHead className='text-center'>행위</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{editedNodes.map(node => {
								const isEditing = editingId === node._id
								const selectedPreview = previews[node._id] // data URL bo'lishi mumkin

								// 표시 우선순위: 업로드 미리보기 > S3 매칭 > 기존 서버 이미지
								const s3Url = getS3UrlByTriple(node, buildingName)
								const legacyUrl = getNodeImageSrc(node)
								const displaySrc = selectedPreview || s3Url || legacyUrl

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
																className='w-16 h-auto object-cover rounded border bg-white transition-transform duration-200 origin-center hover:scale-[4] relative z-0 hover:z-50 shadow cursor-zoom-in'
																onClick={() => setViewerSrc(selectedPreview)}
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
														<button
															type="button"
															onClick={() => setViewerSrc(displaySrc)}
															className="focus:outline-none cursor-zoom-in"
															title="이미지 크게 보기"
														>
															<ImageOnce src={displaySrc} alt="Node image" />
														</button>
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

			{/* 🖼 이미지 뷰어(라이트박스) */}
			{viewerSrc && (
				<div
					className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
					onClick={() => setViewerSrc(null)} // 배경 클릭 닫기
				>
					<div
						className="relative max-w-5xl w-full"
						onClick={(e) => e.stopPropagation()} // 이미지 클릭은 전파 막기
					>
						<button
							type="button"
							className="absolute -top-3 -right-3 bg-white/90 hover:bg-white text-black rounded-full w-8 h-8 flex items-center justify-center shadow"
							onClick={() => setViewerSrc(null)}
							aria-label="닫기"
							title="닫기"
						>
							✕
						</button>

						<img
							src={viewerSrc}
							alt="preview"
							className="w-full h-auto rounded-lg shadow-lg bg-white"
						/>
					</div>
				</div>
			)}
		</div>
	)
}

// ============================ Gateways Edit Modal ============================= //

interface GatewaysEditModalProps {
	isOpen: boolean
	onClose: () => void
	gatewyas: IGateway[]
	onSave: (updatedNodes: IAngleNode[]) => void
}

export const GatewaysEditModal = ({
	isOpen,
	onClose,
	gatewyas,
}: GatewaysEditModalProps) => {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editedNodes, setEditedNodes] = useState<IGateway[]>(gatewyas)
	//const [uploadedFiles, setUploadedFiles] = useState<
	//	Record<string, File | null>
	//>({})

	const [previews, setPreviews] = useState<Record<string, string>>({})
	const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

	useEffect(() => {
		setEditedNodes(gatewyas)
	}, [gatewyas])

	if (!isOpen) return null

	const handleEdit = (nodeId: string) => setEditingId(nodeId)

	// const handleSave = async (nodeId: string) => {
	// 	const nodeToSave = editedNodes.find(n => n._id === nodeId)
	// 	if (!nodeToSave) return
	// 	try {
	// 		const fd = new FormData()
	// 		fd.append('node_position', nodeToSave.position ?? '')
	// 		const file = uploadedFiles[nodeId]
	// 		if (file) {
	// 			// backend: node_image — fayl field nomi
	// 			fd.append('image', file, file.name)
	// 		}
	// 		// Eslatma: fayl yo‘q bo‘lsa umuman node_image append qilmaymiz
	// 		const response = await axios.put(
	// 			`${SERVER_BASE_URL}/product/angle-node/${nodeId}`,
	// 			fd,
	// 			{
	// 				headers: {
	// 					'Content-Type': 'multipart/form-data',
	// 				},
	// 			}
	// 		)
	// 		if (response.status >= 200 && response.status < 300) {
	// 			// tozalash
	// 			setEditingId(null)
	// 			// objectURL ni tozalash
	// 			const url = previews[nodeId]
	// 			if (url) URL.revokeObjectURL(url)
	// 			setPreviews(prev => {
	// 				const copy = { ...prev }
	// 				delete copy[nodeId]
	// 				return copy
	// 			})
	// 			//setUploadedFiles(prev => {
	// 			//	const copy = { ...prev }
	// 			//	delete copy[nodeId]
	// 			//	return copy
	// 			//})
	// 			// serverdan qaytgan yangi path bo‘lsa, local statega yozib qo‘ying (ixtiyoriy)
	// 			// const updatedPath = response.data?.angle_node_img
	// 			// if (updatedPath) {
	// 			// 	setEditedNodes(prev =>
	// 			// 		prev.map(n =>
	// 			// 			n._id === nodeId ? { ...n, angle_node_img: updatedPath } : n
	// 			// 		)
	// 			// 	)
	// 			// }
	// 		} else {
	// 			console.error('Failed to save node')
	// 		}
	// 	} catch (e) {
	// 		console.error('Error saving node:', e)
	// 	}
	// }

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
		//setUploadedFiles({})
		setEditedNodes(gatewyas)
		setEditingId(null)
		Object.values(fileInputRefs.current).forEach(input => {
			if (input) input.value = ''
		})
	}

	// const handleInputChange = (
	// 	nodeId: string,
	// 	field: 'position' | 'angle_node_img',
	// 	value: string
	// ) => {
	// 	setEditedNodes(prev =>
	// 		prev.map(node =>
	// 			node._id === nodeId ? { ...node, [field]: value } : node
	// 		)
	// 	)
	// }

	// const handleFileUpload = (
	// 	nodeId: string,
	// 	e: React.ChangeEvent<HTMLInputElement>
	// ) => {
	// 	const file = e.target.files?.[0]
	// 	if (!file) return
	// 	// Faylni saqlaymiz
	// 	setUploadedFiles(prev => ({ ...prev, [nodeId]: file }))
	// 	// Preview uchun object URL
	// 	const url = URL.createObjectURL(file)
	// 	setPreviews(prev => ({ ...prev, [nodeId]: url }))
	// 	// (ixtiyoriy) UI da ko‘rinishi uchun node modeliga ham yozib qo‘ysak 보‘iladi
	// 	setEditedNodes(prev =>
	// 		prev.map(n => (n._id === nodeId ? { ...n, angle_node_img: url } : n))
	// 	)
	// }

	// const handleImageCancel = (nodeId: string) => {
	// 	// objectURL ni tozalash
	// 	const url = previews[nodeId]
	// 	if (url) URL.revokeObjectURL(url)
	// 	setPreviews(prev => {
	// 		const copy = { ...prev }
	// 		delete copy[nodeId]
	// 		return copy
	// 	})
	// 	// setUploadedFiles(prev => {
	// 	// 	const copy = { ...prev }
	// 	// 	delete copy[nodeId]
	// 	// 	return copy
	// 	// })
	// 	// inputni tozalash
	// 	// const input = fileInputRefs.current[nodeId]
	// 	// if (input) input.value = ''
	// 	// UI: preview o‘rniga eski rasm yoki hech нarsa
	// 	// setEditedNodes(prev =>
	// 	// 	prev.map(n =>
	// 	// 		n._id === nodeId ? { ...n, angle_node_img: n.angle_node_img ?? '' } : n
	// 	// 	)
	// 	// )
	// }

	// const handleSaveAll = () => {
	// 	onSave(editedNodes)
	// 	onClose()
	// }

	// const getNodeImageSrc = (node: IAngleNode) => {
	// 	if (!node.angle_node_img) return undefined
	// 	// Talab bo‘yicha: mavjud bo‘lsa doim bazaviy URL bilan
	// 	return `${imageBasUrl}/${node.angle_node_img || 'placeholder.svg'}`
	// }

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
			<Card className='w-full max-w-full h-[90vh] overflow-hidden'>
				<CardHeader className='flex flex-row items-center justify-between'>
					<CardTitle>게이트웨이 편집</CardTitle>
					<Button variant='ghost' size='sm' onClick={onClose}>
						<X className='w-4 h-4' />
					</Button>
				</CardHeader>

				<CardContent className='overflow-auto max-h-[70vh]'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>게이트웨이 넘버</TableHead>
								<TableHead>등록된 노드</TableHead>
								<TableHead>등록된 비계전도 노드</TableHead>
								<TableHead>게이트웨이 구역</TableHead>
								<TableHead className='text-center'>행위</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{editedNodes.map(gw => {
								const isEditing = editingId === gw._id
								// const selectedPreview = previews[gw._id] // data URL bo'lishi mumkin
								// const displaySrc = getNodeImageSrc(node)

								return (
									<TableRow key={gw._id}>
										<TableCell className='font-medium'>
											{gw.serial_number}
										</TableCell>
										<TableCell>
											{gw.nodes.map(node => node.doorNum).join(', ')}
										</TableCell>
										<TableCell>
											{gw.angle_nodes.map(node => node.doorNum).join(' · ')}
										</TableCell>

										<TableCell>
											{isEditing ? (
												<Input
													value={gw.zone_name || ''}
													// onChange={e =>
													// 	handleInputChange(
													// 		node._id,
													// 		'position',
													// 		e.target.value
													// 	)
													// }
													className='w-full'
												/>
											) : (
												gw.zone_name || 'N/A'
											)}
										</TableCell>

										{/* <TableCell>
											{isEditing ? (
												<div className='flex flex-col gap-2'>
													{!selectedPreview ? (
														// 1) Edit rejimida — avval upload tugmasi
														<div className='flex gap-2 items-center'>
															<Button
																size='sm'
																variant='outline'
																onClick={() =>
																	fileInputRefs.current[gw._id]?.click()
																}
																className='flex items-center gap-1'
															>
																<Upload className='w-3 h-3' />
																Upload
															</Button>

															<input
																ref={el => (fileInputRefs.current[gw._id] = el)}
																type='file'
																accept='image/*'
																// onChange={e => handleFileUpload(gw._id, e)}
																className='hidden'
															/>
														</div>
													) : (
														// 2) Fayl tan랑анда — preview + cancel
														<div className='relative inline-block'>
															<img
																src={selectedPreview}
																alt='Node preview'
																className='w-16 h-auto object-cover rounded border bg-white transition-transform duration-200 origin-center hover:scale-[4] relative z-0 hover:z-50 shadow'
															/>
															<Button
																size='icon'
																// variant='outline'
																// onClick={() => handleImageCancel(node._id)}
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
												// displaySrc && (
												<div className='relative group'>
													<img
														// src={displaySrc}
														alt='Node image'
														className='w-16 h-auto object-cover rounded border bg-white transition-transform duration-200 origin-center hover:scale-[4] relative z-0 hover:z-50 shadow'
													/>
												</div>
												// )
											)}
										</TableCell> */}

										<TableCell>
											<div className='flex gap-2 justify-center'>
												{isEditing ? (
													<>
														<Button
															size='sm'
															// onClick={() => handleSave(node._id)}
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
														onClick={() => handleEdit(gw._id)}
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
					<Button>모든 변경사항 저장</Button>
				</div>
			</Card>
		</div>
	)
}
