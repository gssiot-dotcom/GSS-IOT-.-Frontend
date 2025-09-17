'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { IAngleNode } from '@/types/interfaces'
import { useEffect, useState } from 'react'

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
	}, [node, base])

	if (!node) return null

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
	const showingImage = !!serverImageUrl
	const currentImage = showingImage ? serverImageUrl : ''

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
						{currentImage && (
							<div className='relative w-full h-full flex items-center justify-center'>
								<img
									src={currentImage || '/placeholder.svg'}
									alt={`노드 ${node.doorNum} 이미지`}
									className='max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg'
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
														!node.node_alive
															? 'bg-green-100 text-green-800'
															: 'bg-red-100 text-red-800'
													}`}
												>
													{!node.node_alive ? 'live' : 'offline'}
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
								onClick={() => onClose()}
								className='w-full bg-blue-600 hover:bg-blue-700'
							>
								닫기
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
