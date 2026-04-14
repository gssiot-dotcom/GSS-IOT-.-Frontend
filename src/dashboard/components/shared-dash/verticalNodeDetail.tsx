'use client'

import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { IAngleNode } from '@/types/interfaces'
import { useEffect, useMemo, useState } from 'react'

const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'

const toS3Folder = (name: string) =>
	encodeURIComponent(name).replace(/%20/g, '+')

const toKeyPart = (s?: string | number) =>
	s == null ? '' : encodeURIComponent(String(s).trim())

const sanitizePosForFilename = (s?: string) =>
	(s ?? '').trim().replace(/[\/\\]/g, '')

interface NodeDetailModalProps {
	isOpen: boolean
	onClose: () => void
	node: IAngleNode | null
	buildingName?: string
}

export const NodeDetailModal = ({
	isOpen,
	onClose,
	node,
	buildingName,
}: NodeDetailModalProps) => {
	const base = import.meta.env.VITE_SERVER_BASE_URL

	const [displayImage, setDisplayImage] = useState('')
	const [imageError, setImageError] = useState(false)

	const [isPositionModalOpen, setIsPositionModalOpen] = useState(false)
	const [positionText, setPositionText] = useState('')
	const [positionNumber, setPositionNumber] = useState<number>(1)
	const [savingPosition, setSavingPosition] = useState(false)

	const nodeNumber = useMemo(() => {
		if (!node) return undefined
		return (node as any).node_number ?? node.doorNum
	}, [node])

	useEffect(() => {
		if (!node) return
		setPositionText(node.position || '')
		setPositionNumber(1)
	}, [node, isOpen])

	useEffect(() => {
		if (!isOpen || !node) return

		const nextS3Url = (() => {
			if (!buildingName) return ''

			const folder = toS3Folder(buildingName)
			const pos = encodeURIComponent(sanitizePosForFilename(node.position))
			const gw = toKeyPart(node.gateway_id?.serial_number)
			const nodeNo = toKeyPart((node as any).node_number ?? node.doorNum)

			if (!pos || !gw || !nodeNo) return ''
			return `${S3_BASE_URL}/${folder}/${pos}_${gw}_${nodeNo}.jpg`
		})()

		const nextLegacyUrl = node.angle_node_img
			? `${base}/static/images/${node.angle_node_img}`
			: ''

		setDisplayImage(nextS3Url || nextLegacyUrl || '')
		setImageError(false)
	}, [isOpen, nodeNumber, buildingName, base])

	if (!node) return null

	const getStatus = (x: number) => {
		const a = Math.abs(x)
		if (a > 3) return { color: 'red', label: '위험' }
		if (a > 2) return { color: 'yellow', label: '경고' }
		if (a > 1) return { color: 'green', label: '주의' }
		return { color: 'blue', label: '정상' }
	}

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

	const status = getStatus(node.angle_x ?? 0)
	const colors = CLASS_MAP[status.color as keyof typeof CLASS_MAP]

	const numberOptions = Array.from({ length: 100 }, (_, i) => i + 1)

	const handleSavePosition = async () => {
		if (!nodeNumber) {
			alert('노드 번호가 없습니다.')
			return
		}

		if (!positionText.trim()) {
			alert('포지션을 입력해주세요.')
			return
		}

		setSavingPosition(true)
		try {
			const res = await axios.patch(
				`${import.meta.env.VITE_SERVER_BASE_URL}/vertical-node/verticalnode/${nodeNumber}`,
				{
					position: positionText.trim(),
					floor: String(positionNumber),
				},
				{
					withCredentials: true,
				},
			)

			console.log('위치 저장 성공:', res.data)
			alert('위치가 저장되었습니다.')
			setIsPositionModalOpen(false)
		} catch (error: any) {
			console.error('위치 저장 실패:', error?.response?.data || error)
			alert(error?.response?.data?.message || '위치 저장 중 오류가 발생했습니다.')
		} finally {
			setSavingPosition(false)
		}
	}

	return (
		<>
			<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
				<DialogContent
					className="
						fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
						w-[95vw] max-w-6xl
						h-auto max-h-[calc(100vh-40px)]
						p-0 overflow-hidden
					"
				>
					<DialogHeader className="border-b p-4 pb-4 sm:p-6">
						<DialogTitle className="text-lg font-bold text-gray-800 sm:text-xl">
							노드 {nodeNumber}번 상세 정보
						</DialogTitle>
					</DialogHeader>

					<div className="flex max-h-[calc(100vh-110px)] flex-col items-stretch overflow-y-auto md:flex-row">
						<div className="flex min-h-[260px] w-full items-center justify-center bg-gray-50 p-3 sm:p-6 md:min-h-0 md:w-3/4">
							{displayImage && !imageError ? (
								<img
									src={displayImage}
									alt={`노드 ${nodeNumber} 이미지`}
									className="h-auto max-h-[40vh] w-full rounded-lg object-contain shadow-lg md:max-h-[calc(100vh-64px-72px-48px)]"
									onError={e => {
										const img = e.currentTarget as HTMLImageElement
										if (img.src.endsWith('/no-image.png')) {
											setImageError(true)
											return
										}
										img.src = '/no-image.png'
									}}
								/>
							) : (
								<div className="text-sm text-gray-400">이미지가 없습니다.</div>
							)}
						</div>

						<div className="w-full border-t bg-white p-3 sm:p-6 md:w-1/4 md:border-l md:border-t-0 md:-mt-[2vh]">
							<div className="space-y-4">
								<Card className={`${colors.text} ${colors.bg} border-2`}>
									<CardContent className="p-4">
										<div className="text-center">
											<h3 className="mb-2 text-xl font-bold sm:text-2xl">
												노드 {nodeNumber}
											</h3>

											<div className="space-y-3 text-sm sm:text-base">
												<div className="flex items-center justify-between gap-3">
													<span className="font-medium">Axis-X:</span>
													<span className="font-bold text-base sm:text-lg">
														{node.angle_x}°
													</span>
												</div>

												<div className="flex items-center justify-between gap-3">
													<span className="font-medium">Axis-Y:</span>
													<span className="font-bold text-base sm:text-lg">
														{node.angle_y}°
													</span>
												</div>

												<div className="flex items-start justify-between gap-3">
													<span className="font-medium">Gateway:</span>
													<span className="break-all text-right font-mono text-xs sm:text-sm">
														{node.gateway_id?.serial_number || 'N/A'}
													</span>
												</div>

												<div className="flex items-center justify-between gap-3">
													<span className="font-medium">상태:</span>
													<span
														className={`text-xs font-bold ${node.node_alive ? 'text-blue-600' : 'text-gray-700'
															}`}
													>
														{node.node_alive ? 'online' : 'offline'}
													</span>
												</div>

												<div className="flex items-start justify-between gap-3">
													<span className="font-medium">Position:</span>
													<span className="break-all text-right text-xs sm:text-sm">
														{node.position || 'N/A'}
													</span>
												</div>

												<div className="flex items-center justify-between gap-3">
													<span className="font-medium">Floor:</span>
													<span className="text-xs sm:text-sm text-right">
														{node.floor || 'N/A'}층
													</span>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>

								<Card className="border-gray-200">
									<CardContent className="p-4">
										<h4 className="mb-3 font-bold text-gray-700">위험도 분석</h4>
										<div className="space-y-2">
											<div className="flex justify-between gap-3">
												<span className="text-sm">기울기 정도:</span>
												<span className={`text-sm font-bold ${colors.text}`}>
													{status.label}
												</span>
											</div>
											<div className="h-2 w-full rounded-full bg-gray-200">
												<div
													className={`h-2 rounded-full ${colors.bar}`}
													style={{
														width: `${Math.min(
															Math.abs(node.angle_x ?? 0) * 20,
															100,
														)}%`,
													}}
												/>
											</div>
										</div>
									</CardContent>
								</Card>

								<div className="space-y-2">
									<Button
										onClick={() => setIsPositionModalOpen(true)}
										className="w-full bg-emerald-600 hover:bg-emerald-700"
									>
										위치수정
									</Button>

									<Button
										onClick={onClose}
										className="w-full bg-blue-600 hover:bg-blue-700"
									>
										닫기
									</Button>
								</div>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={isPositionModalOpen} onOpenChange={setIsPositionModalOpen}>
				<DialogContent className="w-[92vw] max-w-md">
					<DialogHeader>
						<DialogTitle>위치 수정</DialogTitle>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-700">포지션</label>
							<input
								type="text"
								value={positionText}
								onChange={e => setPositionText(e.target.value)}
								placeholder="포지션 입력"
								className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium text-gray-700">숫자 선택</label>
							<select
								value={positionNumber}
								onChange={e => setPositionNumber(Number(e.target.value))}
								className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
							>
								{numberOptions.map(num => (
									<option key={num} value={num}>
										{num}
									</option>
								))}
							</select>
						</div>

						<div className="flex gap-2 pt-2">
							<Button
								type="button"
								variant="outline"
								className="w-full"
								onClick={() => setIsPositionModalOpen(false)}
								disabled={savingPosition}
							>
								취소
							</Button>

							<Button
								type="button"
								className="w-full bg-blue-600 hover:bg-blue-700"
								onClick={handleSavePosition}
								disabled={savingPosition}
							>
								{savingPosition ? '저장 중...' : '저장'}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}