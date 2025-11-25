/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IAngleNode, IGateway } from '@/types/interfaces'
import axios from 'axios'
import { Edit2, Upload } from 'lucide-react'
import React, { useRef, useState } from 'react'
import { GatewaysEditModal, NodesEditModal } from './productEdit'
import Draggable from 'react-draggable'

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Draggable handle=".drag-handle">
        <div className="bg-white p-4 rounded-lg max-w-4xl w-full mx-2 shadow-lg">
          {/* 드래그 핸들 */}
          <div className="drag-handle cursor-move bg-gray-200 p-2 rounded-t-md">
            <h3 className="text-lg font-semibold">{buildingName}</h3>
          </div>

          {/* 본문 */}
          <div className="mt-2">
            <img src={imageUrl} alt="Building" className="w-full h-auto" />
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>닫기</Button>
          </div>
        </div>
      </Draggable>
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


  return (
    <Card className="border-slate-400 mx-auto w-full h-[6vh]">
      <CardContent className="p-2 h-full flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
          {/* Floor Plan Upload */}
          <>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              onClick={handleUploadClick}
              className="flex items-center gap-2 h-auto py-2 border-slate-400"
            >
              <Upload className="w-4 h-4" />
              <span className="text-xs">도면 업로드</span>
            </Button>
          </>

          {/* Nodes Edit */}
          <Button
            variant="outline"
            onClick={() => setIsNodesModalOpen(true)}
            className="flex items-center gap-2 h-auto py-2 border-slate-400"
          >
            <Edit2 className="w-4 h-4" />
            <span className="text-xs">노드 정보</span>
          </Button>

          {/* Gateways Edit */}
          <Button
            variant="outline"
            onClick={() => setIsGwsModalOpen(true)}
            className="flex items-center gap-2 h-auto py-2 border-slate-400"
          >
            <Edit2 className="w-4 h-4" />
            <span className="text-xs">게이트웨이 정보</span>
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

        {/* ✅ Nodes Edit Modal — S3 이미지 자동 매칭을 위해 buildingName 전달 */}
        <NodesEditModal
          isOpen={isNodesModalOpen}
          onClose={() => setIsNodesModalOpen(false)}
          angleNodes={angle_nodes}
          buildingName={building?.building_name} // 🔥 추가
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
