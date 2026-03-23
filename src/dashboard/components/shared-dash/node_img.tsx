'use client'

import { useMemo, useRef, useState } from 'react'
import type { IAngleNode } from '@/types/interfaces'

interface Props {
  isOpen: boolean
  onClose: () => void
  angleNodes: IAngleNode[]
  buildingName?: string
}

const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL
const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'

const toS3Folder = (name: string) => encodeURIComponent(name).replace(/%20/g, '+')
const toKeyPart = (s?: string | number) =>
  s == null ? '' : encodeURIComponent(String(s).trim())
const sanitizePosForFilename = (s?: string) => (s ?? '').trim().replace(/[\/\\]/g, '')

const buildNodeImageUrl = (node?: IAngleNode | null, buildingName?: string) => {
  if (!node || !buildingName) return undefined

  const folder = toS3Folder(buildingName)
  const pos = encodeURIComponent(sanitizePosForFilename((node as any).position))
  const gw = toKeyPart((node as any)?.gateway_id?.serial_number)
  const door = toKeyPart((node as any).doorNum)

  if (!pos || !gw || !door) return undefined
  return `${S3_BASE_URL}/${folder}/${pos}_${gw}_${door}.jpg`
}

const NodeImgModal = ({ isOpen, onClose, angleNodes, buildingName }: Props) => {
  const [uploadingDoorNum, setUploadingDoorNum] = useState<number | null>(null)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const sortedNodes = useMemo(() => {
    return [...(angleNodes ?? [])].sort(
      (a, b) => Number((a as any).doorNum) - Number((b as any).doorNum),
    )
  }, [angleNodes])

  if (!isOpen) return null

  const handleClickUpload = (doorNum: number) => {
    if (!buildingName?.trim()) {
      alert('건물명이 없어 업로드할 수 없습니다.')
      return
    }
    fileInputRefs.current[doorNum]?.click()
  }

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    node: IAngleNode,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!buildingName?.trim()) {
      alert('건물명이 없어 업로드할 수 없습니다.')
      return
    }

    try {
      const doorNum = Number((node as any).doorNum)
      setUploadingDoorNum(doorNum)

      const pos = sanitizePosForFilename((node as any).position)
      const gw = String((node as any)?.gateway_id?.serial_number ?? '').trim()

      if (!pos || !gw || !doorNum) {
        throw new Error('노드 이미지 파일명을 만들 수 없습니다.')
      }

      const fileName = `${pos}_${gw}_${doorNum}.jpg`
      const renamedFile = new File([file], fileName, {
        type: file.type || 'image/jpeg',
      })

      const formData = new FormData()
      formData.append('file', renamedFile)

      const uploadUrl = `${SERVER_BASE_URL}/files/upload?folder=${encodeURIComponent(
        buildingName.trim(),
      )}`

      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      const text = await res.text()
      console.log('[UPLOAD STATUS]', res.status)
      console.log('[UPLOAD RESPONSE TEXT]', text)

      if (!res.ok) {
        throw new Error('노드 이미지 업로드에 실패했습니다.')
      }

      alert(`노드 ${doorNum} 이미지 업로드가 완료되었습니다.`)

      if (fileInputRefs.current[doorNum]) {
        fileInputRefs.current[doorNum]!.value = ''
      }
    } catch (error) {
      console.error(error)
      alert('노드 이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingDoorNum(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-[10000] w-[96vw] max-w-[1280px] h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-300 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <h2 className="text-xl font-bold text-slate-800">도면 업로드</h2>
        </div>

        <div className="px-6 py-4 h-[calc(90vh-80px)] overflow-y-auto">
          <div className="grid grid-cols-[1fr_1.5fr_1.5fr_1.5fr_1fr] gap-4 px-2 py-3 text-sm font-semibold text-slate-500 border-b">
            <div>노드 넘버</div>
            <div>속한 게이트웨이</div>
            <div>설치 구간</div>
            <div>설치된 이미지</div>
            <div>수정</div>
          </div>

          {sortedNodes.map(node => {
            const doorNum = Number((node as any).doorNum)
            const imageUrl = buildNodeImageUrl(node, buildingName)

            return (
              <div
                key={doorNum}
                className="grid grid-cols-[1fr_1.5fr_1.5fr_1.5fr_1fr] gap-4 px-2 py-4 text-sm items-center border-b border-slate-200"
              >
                <div>{doorNum}</div>
                <div>{(node as any)?.gateway_id?.serial_number || 'N/A'}</div>
                <div>{(node as any).position || 'N/A'}</div>

                <div>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`node-${doorNum}`}
                      className="h-12 w-20 rounded object-cover border"
                      onError={e => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="text-slate-400">No Image</span>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => handleClickUpload(doorNum)}
                    className="px-4 py-2 rounded-lg border bg-white hover:bg-slate-50 shadow-sm"
                    disabled={uploadingDoorNum === doorNum}
                  >
                    {uploadingDoorNum === doorNum ? '업로드 중...' : '도면 업로드'}
                  </button>

                  <input
                    ref={el => {
                      fileInputRefs.current[doorNum] = el
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handleUploadImage(e, node)}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end px-6 py-4 border-t bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border bg-slate-50 hover:bg-slate-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default NodeImgModal