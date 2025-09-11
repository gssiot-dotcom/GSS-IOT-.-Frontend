'use client'

import type React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { IAngleNode } from '@/types/interfaces'
import axios from 'axios'
import { Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface NodeDetailModalProps {
	isOpen: boolean
	onClose: () => void
	node: IAngleNode | null
}

export const NodeDetailModal = ({
	isOpen,
	onClose,
	node,
}: NodeDetailModalProps) => {
	const [dragActive, setDragActive] = useState(false)
	const [uploadedImage, setUploadedImage] = useState<string | null>(null) // preview (DataURL)
	const [uploadedFile, setUploadedFile] = useState<File | null>(null) // asl fayl
	const [isEditingImage, setIsEditingImage] = useState(false) // <--- YANGI
	const base = import.meta.env.VITE_SERVER_BASE_URL
	// serverdan kelgan hozirgi rasm URL’ini lokal state’da ushlaymiz
	const [serverImageUrl, setServerImageUrl] = useState<string | null>(null)

	// node o‘zgarsa hammasini reset qilamiz
	useEffect(() => {
		if (!node) return
		const url = node.angle_node_img
			? `${base}/static/images/${node.angle_node_img}`
			: null
		setServerImageUrl(url)
		setIsEditingImage(false)
		setUploadedImage(null)
		setUploadedFile(null)
		setDragActive(false)
	}, [node, base])

	if (!node) return null

	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (e.type === 'dragenter' || e.type === 'dragover') {
			setDragActive(true)
		} else if (e.type === 'dragleave') {
			setDragActive(false)
		}
	}

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDragActive(false)

		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			handleFile(e.dataTransfer.files[0])
		}
	}

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			handleFile(e.target.files[0])
		}
	}

	const handleFile = (file: File) => {
		if (file.type.startsWith('image/')) {
			const reader = new FileReader()
			reader.onload = e => {
				setUploadedImage(e.target?.result as string) // preview uchun
				setUploadedFile(file) // yuborish uchun
			}
			reader.readAsDataURL(file)
		}
	}

	// Edit’ni bekor qilish (Back)
	const handleCancelEdit = () => {
		setIsEditingImage(false)
		setUploadedImage(null)
		setUploadedFile(null)
		setDragActive(false)
	}

	// 2) FormData bilan yuborish
	const handleImageUploadRequest = async (nodeId: string) => {
		if (!uploadedFile) return

		try {
			const formData = new FormData()
			// backend kutayotgan nomga moslang: masalan 'image' yoki 'file'
			formData.append('image', uploadedFile, uploadedFile.name)
			formData.append('node_id', nodeId) // kerak bo‘lsa qo‘shimcha maydon

			// endpointingizni moslang (misol)
			const res = await axios.put(
				`${import.meta.env.VITE_SERVER_BASE_URL}/product/angle-node/image`,
				formData, // E’TIBOR: Content-Type qo‘ymang, browser o‘zi boundary bilan qo‘yadi
				// headers qo‘ymang: {'Content-Type': 'multipart/form-data'} NI yozmang!
				{ headers: { 'Content-Type': 'multipart/form-data' } }
			)

			if (res.status < 200 || res.status >= 300) {
				const txt = res.statusText || ''
				throw new Error(txt || `Upload failed with ${res.status}`)
			}

			const { imageUrl, filename } = res.data || {}

			const nextUrl = imageUrl
				? imageUrl.startsWith('http')
					? imageUrl
					: `${base}${imageUrl}`
				: filename
				? `${base}/static/images/${filename}`
				: serverImageUrl

			setServerImageUrl(nextUrl || null)
			setIsEditingImage(false)
			setUploadedImage(null)
			setUploadedFile(null)
			toast.success('이미지 업로드 성공!') // rasm muvaffaqiyatli yuklandi
		} catch (error) {
			console.error(error)
			toast.error('에러 발생! 다시 시도해주세요.') // xatolik yuz berdi
		}
	}

	const getStatus = (x: number) => {
		const a = Math.abs(x)
		if (a > 3) return { color: 'red', label: '위험' } // > 3  => red
		if (a > 2) return { color: 'yellow', label: '경고' } // (2, 3] => yellow
		if (a > 1) return { color: 'green', label: '주의' } // (1, 2] => green
		return { color: 'blue', label: '정상' } // <= 1  => blue
	}

	// 2) Tailwind klasslar xaritasi (100/500/600 saqlanadi)
	const CLASS_MAP = {
		blue: { text: 'text-blue-600', bg: 'bg-blue-100', bar: 'bg-blue-500' },
		green: { text: 'text-green-600', bg: 'bg-green-100', bar: 'bg-green-500' },
		yellow: {
			text: 'text-yellow-600',
			bg: 'bg-yellow-100',
			bar: 'bg-yellow-500',
		},
		red: { text: 'text-red-600', bg: 'bg-red-100', bar: 'bg-red-500' },
	} as const

	const status = getStatus(node.angle_x)
	const colors = CLASS_MAP[status.color as keyof typeof CLASS_MAP]
	const showingImage = !isEditingImage && !!serverImageUrl
	const currentImage = showingImage ? serverImageUrl : uploadedImage

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className='max-w-6xl w-[90vw] h-[80vh] p-0'>
				<DialogHeader className='p-6 pb-4 border-b'>
					<DialogTitle className='text-xl font-bold text-gray-800'>
						노드 {node.doorNum}번 상세 정보
					</DialogTitle>
				</DialogHeader>

				<div className='flex h-full'>
					{/* Left side - Image (75% width) */}
					<div className='w-3/4 p-6 flex flex-col items-center justify-center bg-gray-50'>
						{currentImage ? (
							<div className='relative w-full h-full flex items-center justify-center'>
								<img
									src={currentImage || '/placeholder.svg'}
									alt={`노드 ${node.doorNum} 이미지`}
									className='max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg'
								/>
								<Button
									variant='destructive'
									size='sm'
									className='absolute top-4 right-4'
									onClick={() => setIsEditingImage(true)}
								>
									<X className='w-4 h-4' />
								</Button>
							</div>
						) : (
							<div
								className={`w-full h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors ${
									dragActive
										? 'border-blue-500 bg-blue-50'
										: 'border-gray-300 bg-white'
								}`}
								onDragEnter={handleDrag}
								onDragLeave={handleDrag}
								onDragOver={handleDrag}
								onDrop={handleDrop}
							>
								{/* Back tugmasi */}
								<div className='absolute top-4 left-4 flex gap-2'>
									<Button
										variant='outline'
										size='sm'
										onClick={handleCancelEdit}
									>
										Back
									</Button>
								</div>

								{uploadedImage ? (
									<>
										<img
											src={uploadedImage}
											alt='미리보기'
											className='max-w-full max-h-[60vh] object-contain rounded-lg mb-4'
										/>
										<div className='flex gap-2'>
											<Button asChild variant='outline'>
												<label
													htmlFor='image-upload'
													className='cursor-pointer'
												>
													다른 파일 선택
												</label>
											</Button>
											<Button
												variant='ghost'
												onClick={() => {
													setUploadedImage(null)
													setUploadedFile(null)
												}}
											>
												제거
											</Button>
										</div>
									</>
								) : (
									<>
										<Upload className='w-16 h-16 text-gray-400 mb-4' />
										<p className='text-lg font-medium text-gray-600 mb-2'>
											노드 이미지를 업로드하세요
										</p>
										<p className='text-sm text-gray-500 mb-4'>
											드래그 앤 드롭하거나 클릭하여 파일을 선택하세요
										</p>
										<Button asChild variant='outline'>
											<label htmlFor='image-upload' className='cursor-pointer'>
												파일 선택
											</label>
										</Button>
									</>
								)}

								<input
									type='file'
									accept='image/*'
									onChange={handleFileInput}
									className='hidden'
									id='image-upload'
								/>
							</div>
						)}
					</div>

					{/* Right side - Node Data (20% width) */}
					<div className='w-1/4 p-6 border-l bg-white'>
						<div className='space-y-4'>
							<Card className={`${colors.text} ${colors.bg} border-2`}>
								<CardContent className='p-4'>
									<div className='text-center'>
										<h3 className='text-2xl font-bold mb-2'>
											노드 {node.doorNum}
										</h3>
										<div className='space-y-3'>
											<div className='flex justify-between items-center'>
												<span className='font-medium'>Axis-X:</span>
												<span className='font-bold text-lg'>
													{node.angle_x}°
												</span>
											</div>
											<div className='flex justify-between items-center'>
												<span className='font-medium'>Axis-Y:</span>
												<span className='font-bold text-lg'>
													{node.angle_y}°
												</span>
											</div>
											<div className='flex justify-between items-center'>
												<span className='font-medium'>Gateway:</span>
												<span className='font-mono text-sm'>
													{node.gateway_id?.serial_number || 'N/A'}
												</span>
											</div>
											<div className='flex justify-between items-center'>
												<span className='font-medium'>상태:</span>
												<span
													className={`px-2 py-1 rounded-full text-xs font-bold ${
														!node.node_status
															? 'bg-green-100 text-green-800'
															: 'bg-red-100 text-red-800'
													}`}
												>
													{!node.node_status ? 'live' : 'offline'}
												</span>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>

							<Card className='border-gray-200'>
								<CardContent className='p-4'>
									<h4 className='font-bold text-gray-700 mb-3'>위험도 분석</h4>

									<div className='space-y-2'>
										<div className='flex justify-between'>
											<span className='text-sm'>기울기 정도:</span>
											<span className={`text-sm font-bold ${colors.text}`}>
												{status.label}
											</span>
										</div>

										<div className='w-full bg-gray-200 rounded-full h-2'>
											<div
												className={`h-2 rounded-full ${colors.bar}`}
												style={{
													width: `${Math.min(
														Math.abs(node.angle_x) * 20,
														100
													)}%`,
												}}
											/>
										</div>
									</div>
								</CardContent>
							</Card>

							<Button
								onClick={() => handleImageUploadRequest(node._id)}
								className='w-full bg-blue-600 hover:bg-blue-700'
							>
								이미지 업로드
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
