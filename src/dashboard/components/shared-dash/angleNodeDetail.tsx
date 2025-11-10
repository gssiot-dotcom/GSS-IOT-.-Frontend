'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IAngleNode } from '@/types/interfaces'
import { useEffect, useMemo, useState } from 'react'

const S3_BASE_URL = 'http://gssiot-image-bucket.s3.us-east-1.amazonaws.com'
const toS3Folder = (name: string) => encodeURIComponent(name).replace(/%20/g, '+')
const toKeyPart = (s?: string | number) => (s == null ? '' : encodeURIComponent(String(s).trim()))
const sanitizePosForFilename = (s?: string) => (s ?? '').trim().replace(/[\/\\]/g, '')

// ...imports 동일
interface NodeDetailModalProps {
  isOpen: boolean
  onClose: () => void
  node: IAngleNode | null
  buildingName?: string
  // ✅ 추가: 저장상태 토글 콜백
  onToggleSaveStatus?: (doorNum: number, next: boolean) => Promise<void> | void
}

export const NodeDetailModal = ({ isOpen, onClose, node, buildingName, onToggleSaveStatus }: NodeDetailModalProps) => {
  const base = import.meta.env.VITE_SERVER_BASE_URL
  const [legacyImageUrl, setLegacyImageUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false) // ✅ 로딩 상태

  useEffect(() => {
    if (!node) return
    const url = node.angle_node_img ? `${base}/static/images/${node.angle_node_img}` : null
    setLegacyImageUrl(url)
  }, [node, base])

  const s3Url = useMemo(() => {
    if (!node || !buildingName) return undefined
    const folder = toS3Folder(buildingName)
    const pos = encodeURIComponent(sanitizePosForFilename(node.position))
    const gw = toKeyPart(node.gateway_id?.serial_number)
    const door = toKeyPart(node.doorNum)
    if (!pos || !gw || !door) return undefined
    return `${S3_BASE_URL}/${folder}/${pos}_${gw}_${door}.jpg`
  }, [node, buildingName])

  const currentImage = s3Url || legacyImageUrl || ''
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
    yellow: { text: 'text-yellow-600', bg: 'bg-yellow-100', bar: 'bg-yellow-500' },
    red: { text: 'text-red-600', bg: 'bg-red-100', bar: 'bg-red-500' },
  } as const

  const status = getStatus(node.angle_x)
  const colors = CLASS_MAP[status.color as keyof typeof CLASS_MAP]

  // ✅ 현재 저장상태 (백에서 내려오도록 IAngleNode에 save_status?: boolean 추가 권장)
  const currentSave = !!node.save_status
  const nextSave = !currentSave
  const toggleLabel = currentSave ? '저장 중지' : '저장 시작' // true→false / false→true

  const handleToggleClick = async () => {
    if (!onToggleSaveStatus) return
    setSubmitting(true)
    try {
      await onToggleSaveStatus(node.doorNum, nextSave)
    } catch (e) {
      console.error(e)
      alert('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="
        fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
        w-[92vw] max-w-6xl
        h-auto max-h-[calc(100vh-64px)]
        p-0 overflow-hidden
      ">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl font-bold text-gray-800">
            노드 {node.doorNum}번 상세 정보
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-stretch">
          {/* Left: 이미지 */}
          <div className="w-3/4 p-6 flex items-center justify-center bg-gray-50">
            {currentImage ? (
              <img
                src={currentImage}
                alt={`노드 ${node.doorNum} 이미지`}
                className="w-full h-auto object-contain max-h-[calc(100vh-64px-72px-48px)] rounded-lg shadow-lg"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/no-image.png' }}
              />
            ) : (
              <div className="text-gray-400 text-sm">이미지가 없습니다.</div>
            )}
          </div>

          {/* Right: 정보 패널 */}
          <div className="w-1/4 p-6 border-l bg-white">
            <div className="space-y-4">
              <Card className={`${colors.text} ${colors.bg} border-2`}>
                <CardContent className="p-4">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">노드 {node.doorNum}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Axis-X:</span>
                        <span className="font-bold text-lg">{node.angle_x}°</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Axis-Y:</span>
                        <span className="font-bold text-lg">{node.angle_y}°</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Gateway:</span>
                        <span className="font-mono text-sm">{node.gateway_id?.serial_number || 'N/A'}</span>
                      </div>

                      {/* 온라인/오프라인(파생) */}
                      <div className="flex justify-between items-center">
                        <span className="font-medium">상태:</span>
                        <span className={`text-xs font-bold ${node.node_alive ? 'text-blue' : 'text-black'}`}>
                          {node.node_alive ? 'online' : 'offline'}
                        </span>
                      </div>

                      {/* ✅ 저장상태(원천) */}
                      <div className="flex justify-between items-center">
                        <span className="font-medium">저장 상태:</span>
                        <span className={`text-xs font-bold ${currentSave ? 'text-green-700' : 'text-gray-500'}`}>
                          {currentSave ? '저장 중' : '저장 안 함'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <h4 className="font-bold text-gray-700 mb-3">위험도 분석</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">기울기 정도:</span>
                      <span className={`text-sm font-bold ${colors.text}`}>{status.label}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${colors.bar}`} style={{ width: `${Math.min(Math.abs(node.angle_x) * 20, 100)}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 하단 버튼들 */}
              <div className="space-y-2">
                <Button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700">닫기</Button>

                {/* ✅ 상태변경 버튼(저장상태 토글) */}
                <Button
                  onClick={handleToggleClick}
                  disabled={submitting}
                  className="w-full"
                  variant="outline"
                >
                  {submitting ? '변경 중…' : `상태변경 (${toggleLabel})`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
