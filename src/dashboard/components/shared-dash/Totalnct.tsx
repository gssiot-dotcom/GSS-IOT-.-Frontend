/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { Eye, Upload, FileText, Download, ChartSpline } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { INode } from '@/types/interfaces'

interface IProps2 {
	building?: any
}

interface ITotalcntProps {
	nodes: INode[]
	onFilterChange: (filterOpenDoors: boolean) => void
	building?: any
}

const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'

const toS3Folder = (name: string) =>
	encodeURIComponent(name).replace(/%20/g, '+')

const buildPlanS3Url = (buildingName?: string) => {
	if (!buildingName) return undefined
	const folder = toS3Folder(buildingName)
	return `${S3_BASE_URL}/${folder}/main-img.jpg`
}

const ImageModal = ({
	imageUrl,
	onClose,
	buildingName,
}: {
	imageUrl?: string
	onClose: () => void
	buildingName?: string
}) => {
	const [imgError, setImgError] = useState(false)

	useEffect(() => {
		setImgError(false)
	}, [imageUrl])

	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		window.addEventListener('keydown', handleEsc)
		return () => window.removeEventListener('keydown', handleEsc)
	}, [onClose])

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
			onClick={onClose}
		>
			<div
				className='relative mx-2 w-full max-w-4xl rounded-lg bg-white p-4'
				onClick={e => e.stopPropagation()}
			>
				<button
					type='button'
					onClick={onClose}
					className='absolute top-4 right-4 text-lg text-gray-500 hover:text-black'
				>
					✕
				</button>

				<h3 className='mb-4 pr-10 text-lg font-semibold'>{buildingName}</h3>

				{!imgError && imageUrl ? (
					<img
						src={imageUrl}
						alt='Building Plan'
						className='h-auto max-h-[75vh] w-full object-contain'
						onError={() => setImgError(true)}
					/>
				) : (
					<div className='flex h-[400px] w-full items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-slate-500'>
						업로드된 도면 이미지가 없습니다.
					</div>
				)}
			</div>
		</div>
	)
}

const Totalcnt = ({ nodes, onFilterChange }: ITotalcntProps) => {
	const openCount = nodes?.filter(node => node.doorChk === 1).length ?? 0
	const totalCount = nodes?.length ?? 0

	return (
		<Card className='border-slate-400'>
			<CardContent className='p-4'>
				<div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
					<div className='flex items-center gap-3'>
						<div className='rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700'>
							전체 노드: {totalCount}
						</div>
						<div className='rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700'>
							열림 노드: {openCount}
						</div>
					</div>

					<div className='hidden flex-1 items-center justify-center md:flex'>
						<h1
							className='truncate text-[14px] font-[Giants] leading-tight text-gray-800 sm:text-[16px] md:text-2xl'
							title='해치발판 개폐감지 시스템'
						>
							해치발판 개폐감지 시스템
						</h1>
					</div>

					<div className='flex items-center gap-2'>
						<Button
							variant='outline'
							className='border-slate-400'
							onClick={() => onFilterChange(false)}
						>
							전체 보기
						</Button>
						<Button
							variant='outline'
							className='border-slate-400'
							onClick={() => onFilterChange(true)}
						>
							열림만 보기
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export const NodesMultipleButtonsField = ({ building }: IProps2) => {
	const { clientId } = useParams()

	const [isImageOpen, setIsImageOpen] = useState(false)
	const [openPlanActionModal, setOpenPlanActionModal] = useState(false)
	const [uploadingPlan, setUploadingPlan] = useState(false)
	const [deletingPlan, setDeletingPlan] = useState(false)
	const [planImgUrl, setPlanImgUrl] = useState<string | undefined>(undefined)

	const fileInputRef = useRef<HTMLInputElement | null>(null)

	const selectedBuildingName =
		building?.building_name || building?.name || building?.buildingName || ''

	useEffect(() => {
		setPlanImgUrl(buildPlanS3Url(selectedBuildingName))
	}, [selectedBuildingName])

	const handleDownload = async (id: string) => {
		try {
			const response = await axios.get(
				`${import.meta.env.VITE_SERVER_BASE_URL}/product/download-nodes-history`,
				{
					params: { buildingId: id },
					responseType: 'blob',
				},
			)

			const url = window.URL.createObjectURL(new Blob([response.data]))
			const a = document.createElement('a')
			a.href = url
			a.download = 'building-nodes-history.xlsx'
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
		} catch (error) {
			console.error('Failed to download file:', error)
		}
	}

	const handleClickUpload = () => {
		if (!selectedBuildingName?.trim()) {
			alert('건물명이 없어 업로드 폴더명을 만들 수 없습니다.')
			return
		}

		fileInputRef.current?.click()
	}

	const handleUploadPlanImage = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0]
		if (!file) return

		if (!selectedBuildingName?.trim()) {
			alert('건물명이 없어 업로드할 수 없습니다.')
			return
		}

		try {
			setUploadingPlan(true)

			const renamedFile = new File([file], 'main-img.jpg', {
				type: file.type || 'image/jpeg',
			})

			const formData = new FormData()
			formData.append('file', renamedFile)

			const uploadFolder = toS3Folder(selectedBuildingName.trim())
			const uploadUrl = `${import.meta.env.VITE_SERVER_BASE_URL}/files/upload?folder=${uploadFolder}`

			const res = await fetch(uploadUrl, {
				method: 'POST',
				body: formData,
			})

			const text = await res.text()
			console.log('[UPLOAD STATUS]', res.status)
			console.log('[UPLOAD RESPONSE TEXT]', text)

			if (!res.ok) {
				throw new Error('도면 이미지 업로드에 실패했습니다.')
			}

			const nextUrl = buildPlanS3Url(selectedBuildingName)
			setPlanImgUrl(nextUrl ? `${nextUrl}?t=${Date.now()}` : undefined)

			alert('도면 이미지 업로드가 완료되었습니다.')
			setOpenPlanActionModal(false)
		} catch (error) {
			console.error(error)
			alert('도면 이미지 업로드 중 오류가 발생했습니다.')
		} finally {
			setUploadingPlan(false)
			if (fileInputRef.current) {
				fileInputRef.current.value = ''
			}
		}
	}

	const handleDeletePlanImage = async () => {
		if (!selectedBuildingName?.trim()) {
			alert('건물명이 없어 삭제 경로를 만들 수 없습니다.')
			return
		}

		try {
			setDeletingPlan(true)

			const folder = toS3Folder(selectedBuildingName.trim())

			const res = await fetch(
				`${import.meta.env.VITE_SERVER_BASE_URL}/files/delete`,
				{
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						key: `${folder}/main-img.jpg`,
					}),
				},
			)

			if (!res.ok) {
				throw new Error('도면 이미지 삭제에 실패했습니다.')
			}

			setPlanImgUrl(undefined)

			alert('도면 이미지 삭제가 완료되었습니다.')
			setOpenPlanActionModal(false)
		} catch (error) {
			console.error(error)
			alert('도면 이미지 삭제 중 오류가 발생했습니다.')
		} finally {
			setDeletingPlan(false)
		}
	}

	return (
		<Card className='mt-4 border-slate-400'>
			{building && (
				<CardContent className='p-4'>
					<div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4'>
						<Button
							variant='outline'
							onClick={() => setOpenPlanActionModal(true)}
							className='flex h-auto items-center gap-2 border-slate-400 py-3'
						>
							<Upload className='h-4 w-4' />
							<span className='text-sm'>도면 이미지 업로드</span>
						</Button>

						<Button
							variant='outline'
							onClick={() => setIsImageOpen(true)}
							className='flex h-auto items-center gap-2 border-slate-400 py-3'
						>
							<Eye className='h-4 w-4' />
							<span className='text-sm'>도면 보기</span>
						</Button>

						{building?.nodes_position_file && (
							<Button
								variant='outline'
								asChild
								className='flex h-auto items-center gap-2 border-slate-400 py-3'
							>
								<a
									href={`${
										import.meta.env.VITE_SERVER_BASE_URL
									}/exels/${encodeURIComponent(building.nodes_position_file)}`}
									download
								>
									<FileText className='h-4 w-4' />
									<span className='text-sm'>위치 파일</span>
									<Download className='h-3 w-3' />
								</a>
							</Button>
						)}

						<Button
							variant='outline'
							onClick={() => handleDownload(building._id)}
							className='flex h-auto items-center gap-2 border-slate-400 py-3'
						>
							<FileText className='h-4 w-4' />
							<span className='text-sm'>현장 노드 리포트</span>
							<Download className='h-3 w-3' />
						</Button>

						<Button
							variant='outline'
							asChild
							className='flex h-auto items-center gap-2 border-slate-400 py-3'
						>
							<Link
								to={`/admin/dashboard/clients/${clientId}/buildings/${building._id}/angle-nodes`}
								className='flex items-center gap-2'
							>
								<ChartSpline className='h-4 w-4' />
								<span className='text-sm'>건물 비계전도 노드 보기</span>
							</Link>
						</Button>
					</div>

					{isImageOpen && (
						<ImageModal
							imageUrl={planImgUrl}
							buildingName={building?.building_name}
							onClose={() => setIsImageOpen(false)}
						/>
					)}

					{openPlanActionModal && (
						<div className='fixed inset-0 z-[9999] flex items-start justify-center pt-16'>
							<div
								className='absolute inset-0 bg-black/50'
								onClick={() => setOpenPlanActionModal(false)}
							/>
							<div className='relative z-[10000] w-[480px] max-w-[92vw] overflow-hidden rounded-xl border border-slate-600 bg-white shadow-2xl ring-1 ring-slate-600/60'>
								<div className='flex items-center justify-between bg-slate-800 px-4 py-2 text-white'>
									<h3 className='text-lg font-bold'>전체 도면 관리</h3>
									<button
										onClick={() => setOpenPlanActionModal(false)}
										className='rounded-md bg-white/10 px-2.5 py-1 text-sm hover:bg-white/20'
									>
										닫기
									</button>
								</div>

								<div className='p-4'>
									<p className='mb-4 text-base text-slate-700'>
										건물명 폴더:{' '}
										<span className='font-semibold'>{selectedBuildingName}</span>
									</p>

									<div className='grid grid-cols-2 gap-3'>
										<button
											onClick={handleClickUpload}
											disabled={uploadingPlan || deletingPlan}
											className='h-12 rounded-md bg-blue-600 font-semibold text-white hover:bg-blue-700 disabled:opacity-50'
										>
											{uploadingPlan ? '업로드 중...' : '업로드'}
										</button>

										<button
											onClick={handleDeletePlanImage}
											disabled={uploadingPlan || deletingPlan}
											className='h-12 rounded-md bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-50'
										>
											{deletingPlan ? '삭제 중...' : '삭제'}
										</button>
									</div>
								</div>
							</div>

							<input
								ref={fileInputRef}
								type='file'
								accept='image/*'
								className='hidden'
								onChange={handleUploadPlanImage}
							/>
						</div>
					)}
				</CardContent>
			)}
		</Card>
	)
}

export default Totalcnt