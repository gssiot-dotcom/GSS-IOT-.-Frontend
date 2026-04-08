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
        className={`w-16 h-auto object-cover rounded border bg-white transition-opacity duration-200 ${state === 'loading' ? 'opacity-0' : 'opacity-100'
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
  buildingName?: string
  onNodesChange?: (nodes: IAngleNode[]) => void
  buildingId?: string
}

export const NodesEditModal = ({
  isOpen,
  onClose,
  angleNodes,
  buildingName,
  onNodesChange,
}: NodesEditModalProps) => {
  const [editedNodes, setEditedNodes] = useState<IAngleNode[]>(angleNodes)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  // 🔹 현재 수정 중인 row, 입력 값들
  const [editRow, setEditRow] = useState<string | null>(null)
  const [positionInput, setPositionInput] = useState<string>('')
  const [gatewayInput, setGatewayInput] = useState<string>('') // ✅ 게이트웨이 선택 값(_id)

  // ✅ 게이트웨이 전체 목록
  const [gatewayList, setGatewayList] = useState<IGateway[]>([])

  useEffect(() => {
    setEditedNodes(angleNodes)
  }, [angleNodes])


  useEffect(() => {
    const fetchGateways = async () => {
      try {
        const url = `${import.meta.env.VITE_SERVER_BASE_URL}/gateway/`
        const res = await fetch(url)
        if (!res.ok) throw new Error('게이트웨이 목록 조회 실패')

        const data = await res.json()
        const list: IGateway[] = Array.isArray(data?.gateways) ? data.gateways : []

        // ✅ 이 빌딩의 노드에 연결된 gateway_id만 추출
        const usedGatewayIds = new Set(
          (angleNodes ?? [])
            .map((n: any) => n?.gateway_id?._id)
            .filter(Boolean)
            .map(String)
        )

        const filtered = list.filter((gw: any) => {
          const type = String(gw?.gateway_type ?? '').toUpperCase()
          const isGateway = type === 'GATEWAY' || type === 'NODE_GATEWAY'
          if (!isGateway) return false

          // ✅ 노드에서 쓰이는 GW만
          if (usedGatewayIds.size > 0) return usedGatewayIds.has(String(gw._id))

          // (fallback) 노드에 gateway_id가 아예 없으면 타입만
          return true
        })


        setGatewayList(filtered)
      } catch (e) {
        console.error(e)
        setGatewayList([])
      }
    }

    if (isOpen) fetchGateways()
  }, [isOpen, angleNodes])



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
  // 🔹 노드 설치 구간 저장 요청 (PUT /api/angle-nodes/position)
  const savePosition = async (node: IAngleNode) => {
    try {
      const url = `${import.meta.env.VITE_SERVER_BASE_URL}/angle-node/position`

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doorNum: node.doorNum,
          position: positionInput.trim(),
        }),
      })

      if (!res.ok) throw new Error('저장 실패')

      setEditedNodes(prev => {
        const next = prev.map(n =>
          n._id === node._id ? { ...n, position: positionInput.trim() } : n
        )
        // ✅ 부모에게도 변경된 배열 전달
        onNodesChange?.(next)
        return next
      })

      alert('노드 설치 구간이 수정되었습니다!')
    } catch (err) {
      console.error(err)
      alert('구간 저장 실패')
    }
  }


  const saveGateway = async (node: IAngleNode) => {
    try {
      const url = `${import.meta.env.VITE_SERVER_BASE_URL}/angle-node/${node.doorNum}/gateway`

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway_id: gatewayInput || null,
        }),
      })

      if (!res.ok) throw new Error('게이트웨이 저장 실패')

      const selectedGw =
        gatewayList.find(g => g._id === gatewayInput) || null

      setEditedNodes(prev => {
        const next = prev.map(n =>
          n._id === node._id
            ? { ...n, gateway_id: selectedGw as any }
            : n
        )
        // ✅ 부모에게도 반영
        onNodesChange?.(next)
        return next
      })

      alert('게이트웨이가 수정되었습니다!')
    } catch (err) {
      console.error(err)
      alert('게이트웨이 저장 실패')
    }
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
                <TableHead>수정</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {editedNodes.map(node => {
                const s3Url = getS3UrlByTriple(node, buildingName)
                const legacyUrl = getNodeImageSrc(node)
                const displaySrc = s3Url || legacyUrl

                return (
                  <React.Fragment key={node._id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        {node.doorNum}
                      </TableCell>
                      <TableCell>
                        {node.gateway_id?.serial_number || 'N/A'}
                      </TableCell>
                      <TableCell>{node.position || 'N/A'}</TableCell>
                      <TableCell>
                        {displaySrc ? (
                          <ImageOnce
                            src={displaySrc}
                            alt="Node image"
                            onClick={() => setViewerSrc(displaySrc)}
                          />
                        ) : (
                          <div className="text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditRow(node._id)
                            setPositionInput(node.position ?? '')
                            setGatewayInput(node.gateway_id?._id ?? '')
                          }}
                        >
                          수정
                        </Button>
                      </TableCell>
                    </TableRow>

                    {editRow === node._id && (
                      <TableRow className="bg-gray-50">
                        <TableCell colSpan={5}>
                          <div className="flex items-center gap-4 p-3">
                            {/* ✅ 게이트웨이 선택 */}
                            <select
                              value={gatewayInput}
                              onChange={e =>
                                setGatewayInput(e.target.value)
                              }
                              className="border p-2 rounded"
                            >
                              <option value="">
                                게이트웨이 해제
                              </option>
                              {gatewayList.map(gw => (
                                <option key={gw._id} value={gw._id}>
                                  {gw.serial_number}
                                </option>
                              ))}
                            </select>

                            {/* ✅ 설치 구간 입력 */}
                            <input
                              type="text"
                              value={positionInput}
                              onChange={e =>
                                setPositionInput(e.target.value)
                              }
                              className="border p-2 rounded w-1/3"
                              placeholder="설치 구간 입력"
                            />

                            <Button
                              size="sm"
                              onClick={() => saveGateway(node)}
                            >
                              게이트웨이 저장
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => savePosition(node)}
                            >
                              구간 저장
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditRow(null)}
                            >
                              취소
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
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
            onClick={e => e.stopPropagation()}
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
  onSave?: (updatedGateways: IGateway[]) => void
}

export const GatewaysEditModal = ({
  isOpen,
  onClose,
  gatewyas,
}: GatewaysEditModalProps) => {
  const [editedGateways, setEditedGateways] = useState<IGateway[]>(gatewyas)
  const [editRow, setEditRow] = useState<string | null>(null)
  const [zoneInput, setZoneInput] = useState<string>('')

  useEffect(() => {
    setEditedGateways(gatewyas)
  }, [gatewyas])

  if (!isOpen) return null

  // 🔹 저장 요청 (게이트웨이 id 사용)
  const saveZone = async (gw: IGateway) => {
    try {
      const gatewayId = gw._id // ✅ URL 파라미터로 들어갈 ID

      if (!gatewayId) {
        alert('gateway _id 가 없습니다.')
        return
      }

      const url = `${import.meta.env.VITE_SERVER_BASE_URL}/gateway/${gatewayId}/position`

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_name: zoneInput }), // { "zone_name": "사무실" }
      })

      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(msg || '구역 수정 실패')
      }

      // 클라이언트 상태 업데이트
      setEditedGateways(prev =>
        prev.map(g => (g._id === gw._id ? { ...g, zone_name: zoneInput } : g)),
      )

      setEditRow(null)
      alert('구역이 수정되었습니다!')
    } catch (err) {
      console.error(err)
      alert('저장 실패')
    }
  }

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
                <TableHead>수정</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {editedGateways.map(gw => (
                <React.Fragment key={gw._id}>
                  <TableRow>
                    <TableCell className="font-medium">{gw.serial_number}</TableCell>
                    <TableCell>{gw.nodes.map(n => n.doorNum).join(', ')}</TableCell>
                    <TableCell>{gw.angle_nodes.map(n => n.doorNum).join(' · ')}</TableCell>
                    <TableCell>{gw.zone_name || 'N/A'}</TableCell>

                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditRow(gw._id)
                          setZoneInput(gw.zone_name ?? '')
                        }}
                      >
                        수정
                      </Button>
                    </TableCell>
                  </TableRow>

                  {editRow === gw._id && (
                    <TableRow className="bg-gray-50">
                      <TableCell colSpan={5}>
                        <div className="flex items-center gap-4 p-3">
                          <input
                            type="text"
                            value={zoneInput}
                            onChange={e => setZoneInput(e.target.value)}
                            className="border p-2 rounded w-1/3"
                            placeholder="게이트웨이 구역 입력"
                          />

                          <Button size="sm" onClick={() => saveZone(gw)}>
                            저장
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditRow(null)}
                          >
                            취소
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
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
