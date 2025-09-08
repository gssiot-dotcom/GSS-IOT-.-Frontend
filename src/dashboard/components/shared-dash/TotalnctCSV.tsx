import localImage from '@/assets/node.png'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import axios from 'axios'
import { Download, Eye, FileText, Upload } from 'lucide-react'
import React, { useRef, useState } from 'react'

interface IProps2 {
    building?: {
        _id: string
        building_name?: string
        nodes_position_file?: string
        building_plan_img?: string
    }
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

const NodesMultipleButtonsField = ({ building }: IProps2) => {
    const [isOpen, setIsOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
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
                `${import.meta.env.VITE_SERVER_BASE_URL}/company/upload-company-plan`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                }
            )

            if (res.status < 200 || res.status >= 300)
                throw new Error('Upload failed')
            alert('Upload success ✅')
        } catch (error) {
            console.log(error)
            alert('Upload failed ❌')
        }
    }

    const handleViewPlan = () => {
        setIsOpen(true)
    }

    return (
        <Card className='border-slate-400 mx-auto h-full w-full max-w-[50vw] sm:max-w-[50vw] md:max-w-[60vw] lg:max-w-[34vw] h-[6vh]'>
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
                        onClick={handleViewPlan}
                        className='flex items-center gap-2 h-auto py-2 border-slate-400'
                    >
                        <Eye className='w-4 h-4' />
                        <span className='text-xs'>도면 보기</span>
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
                                    import.meta.env.VITE_SERVER_BASE_URL
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
                {isOpen && (
                    <ImageModal
                        imageUrl={`${import.meta.env.VITE_SERVER_BASE_URL}/static/images/${
                            building?.building_plan_img || localImage
                        }`}
                        buildingName={building?.building_name}
                        onClose={() => setIsOpen(false)}
                    />
                )}
            </CardContent>
        </Card>
    )
}

export default NodesMultipleButtonsField