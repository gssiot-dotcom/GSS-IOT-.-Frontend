/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { IAngleNode, IGateway } from '@/types/interfaces'
import React, { useEffect, useState } from 'react'

const imageBasUrl = `${import.meta.env.VITE_SERVER_BASE_URL}/static/images/`
const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'

const toS3Folder = (name: string) => encodeURIComponent(name).replace(/%20/g, '+')
const toKeyPart = (s?: string | number) =>
	s == null ? '' : encodeURIComponent(String(s).trim())
const sanitizePosForFilename = (s?: string) =>
	(s ?? '').trim().replace(/[\/\\]/g, '')

const PLACEHOLDER = '/no-image.png'
function ImageOnce({
	src,
	alt,
	onClick,
}: {
	src?: string
	alt?: string
	onClick?: () => void
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
		<div
			className="relative cursor-zoom-in"
			onClick={onClick}
			title="이미지 크게 보기"
		>
			{state === 'loading' && (
				<div className="w-16 h-16 rounded border bg-gray-100 animate-pulse" />
			)}
			<img
				src={finalSrc}
				alt={alt}
				loading="lazy"
				className={`w-16 h-auto object-cover rounded border bg-white transition-opacity duration-200 ${
					state === 'loading' ? 'opacity-0' : 'opacity-100'
				}`}
				onLoad={() => setState('ok')}
				onError={() => {
					setFinalSrc(PLACEHOLDER)
					setState('error')
				}}
			/>
		</div>
	)
}

/* ============================ Nodes Edit Modal ============================= */
interface NodesEditModalProps {
	isOpen: boolean
	onClose: () => void
	angleNodes: IAngleNode[]
	onSave: (updatedNodes: IAngleNode[]) => void
	buildingName?: string
}

export const NodesEditModal = ({
	isOpen,
	onClose,
	angleNodes,
	buildingName,
}: NodesEditModalProps) => {
	const [editedNodes, setEditedNodes] = useState<IAngleNode[]>(angleNodes)
	const [viewerSrc, setViewerSrc] = useState<string | null>(null)

	useEffect(() => {
		setEditedNodes(angleNodes)
	}, [angleNodes])

	if (!isOpen) return null

	const getS3UrlByTriple = (node: IAngleNode, building?: string) => {
		if (!building) return undefined
		const folder = toS3Folder(building)
		const pos = encodeURIComponent(sanitizePosForFilename(node.position))
		const gw = toKeyPart(node.gateway_id?.serial_number)
		const door = toKeyPart(node.doorNum)
		if (!pos || !gw || !door) return undefined
		return `${S3_BASE_URL}/${folder}/${pos}_${gw}_${door}.jpg`
	}

	const getNodeImageSrc = (node: IAngleNode) => {
		if (!node.angle_node_img) return undefined
		return `${imageBasUrl}/${node.angle_node_img}`
	}

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<Card className="w-full max-w-7xl max-h-[90vh] overflow-hidden">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>노드 정보</CardTitle>
				</CardHeader>

				<CardContent className="overflow-auto max-h-[70vh]">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>노드 넘버</TableHead>
								<TableHead>속한 게이트웨이</TableHead>
								<TableHead>설치 구간</TableHead>
								<TableHead>설치된 이미지</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{editedNodes.map((node) => {
								const s3Url = getS3UrlByTriple(node, buildingName)
								const legacyUrl = getNodeImageSrc(node)
								const displaySrc = s3Url || legacyUrl
								return (
									<TableRow key={node._id}>
										<TableCell className="font-medium">{node.doorNum}</TableCell>
										<TableCell>{node.gateway_id?.serial_number}</TableCell>
										<TableCell>{node.position || 'N/A'}</TableCell>
										<TableCell>
											{displaySrc ? (
												<ImageOnce
													src={displaySrc}
													alt="Node image"
													onClick={() => setViewerSrc(displaySrc)}
												/>
											) : (
												<div className="text-gray-400 text-xs">No Image</div>
											)}
										</TableCell>
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</CardContent>

				<div className="p-4 border-t flex justify-end gap-2">
					<Button variant="outline" onClick={onClose}>
						닫기
					</Button>
				</div>
			</Card>

			{/* ✅ 이미지 확대 보기 (라이트박스) */}
			{viewerSrc && (
				<div
					className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
					onClick={() => setViewerSrc(null)}
				>
					<div
						className="relative max-w-5xl w-full"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							className="absolute -top-3 -right-3 bg-white/90 hover:bg-white text-black rounded-full w-8 h-8 flex items-center justify-center shadow"
							onClick={() => setViewerSrc(null)}
						>
							✕
						</button>
						<img
							src={viewerSrc}
							alt="확대 이미지"
							className="w-full h-auto rounded-lg shadow-lg bg-white"
						/>
					</div>
				</div>
			)}
		</div>
	)
}

/* ============================ Gateways Edit Modal ============================= */
interface GatewaysEditModalProps {
	isOpen: boolean
	onClose: () => void
	gatewyas: IGateway[]
	onSave: (updatedGateways: IGateway[]) => void
}

export const GatewaysEditModal = ({
	isOpen,
	onClose,
	gatewyas,
}: GatewaysEditModalProps) => {
	const [editedGateways, setEditedGateways] = useState<IGateway[]>(gatewyas)

	useEffect(() => {
		setEditedGateways(gatewyas)
	}, [gatewyas])

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<Card className="w-full max-w-full h-[90vh] overflow-hidden">
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>게이트웨이 정보</CardTitle>
				</CardHeader>

				<CardContent className="overflow-auto max-h-[70vh]">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>게이트웨이 넘버</TableHead>
								<TableHead>등록된 노드</TableHead>
								<TableHead>등록된 비계전도 노드</TableHead>
								<TableHead>게이트웨이 구역</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{editedGateways.map((gw) => (
								<TableRow key={gw._id}>
									<TableCell className="font-medium">{gw.serial_number}</TableCell>
									<TableCell>{gw.nodes.map((n) => n.doorNum).join(', ')}</TableCell>
									<TableCell>{gw.angle_nodes.map((n) => n.doorNum).join(' · ')}</TableCell>
									<TableCell>{gw.zone_name || 'N/A'}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>

				<div className="p-4 border-t flex justify-end gap-2">
					<Button variant="outline" onClick={onClose}>
						닫기
					</Button>
				</div>
			</Card>
		</div>
	)
}
