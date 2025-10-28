'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  buildingId: string
}

const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL

const DownloadButtons = ({ buildingId }: Props) => {
  const [openPicker, setOpenPicker] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [downloading, setDownloading] = useState(false)

  const valid = !!buildingId && !!start && !!end

  const handleDownload = async () => {
    if (!valid) {
      alert('빌딩, 시작일, 종료일을 모두 선택하세요.')
      return
    }

    const url = `${SERVER_BASE_URL}/api/reports/daily-hwpx?date=${encodeURIComponent(
      start
    )}&end=${encodeURIComponent(end)}&buildingId=${encodeURIComponent(buildingId)}`

    try {
      setDownloading(true)
      const res = await fetch(url, { method: 'GET' })

      if (!res.ok) {
        window.open(url, '_blank')
        return
      }

      const blob = await res.blob()
      const fileUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = `GSS_Report_${start}_to_${end}.hwpx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(fileUrl)
    } catch (err) {
      console.error(err)
      window.open(url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card className="border-slate-400 mx-auto w-full h-full">
      <CardContent className="p-1.5 flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
          {/* 3D 도면 보기 */}
          <Button
            variant="outline"
            className="h-auto py-1 border-slate-400 text-sm font-medium"
          >
            3D 도면 보기
          </Button>

          {/* 노드 정보 */}
          <Button
            variant="outline"
            className="h-auto py-1 border-slate-400 text-sm font-medium"
          >
            노드 정보
          </Button>

          {/* 보고서 다운로드 (달력 표시 토글) */}
          <Button
            variant="outline"
            onClick={() => setOpenPicker(true)}
            className="h-auto py-1 border-slate-400 text-sm font-medium"
          >
            보고서 다운로드
          </Button>
        </div>

        {/* ===== 최상단 오버레이 모달 ===== */}
        {openPicker && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-16">
            {/* 배경 */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpenPicker(false)}
            />
            {/* 내용 카드 */}
            <div className="relative z-[10000] w-[720px] max-w-[92vw] rounded-xl bg-white shadow-2xl border border-slate-600 ring-1 ring-slate-600/60">
              <div className="flex items-center justify-between px-4 py-2 rounded-t-xl bg-slate-800 text-white">
                <h3 className="text-sm font-semibold">보고서 다운로드</h3>
                <button
                  onClick={() => setOpenPicker(false)}
                  className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs"
                >
                  닫기
                </button>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">시작 날짜</label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="h-9 rounded-md border border-slate-500 bg-white text-slate-900 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-700">종료 날짜</label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="h-9 rounded-md border border-slate-500 bg-white text-slate-900 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    onClick={handleDownload}
                    disabled={!valid || downloading}
                    className="h-9"
                  >
                    {downloading ? '다운로드 중...' : '다운로드'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpenPicker(false)
                      setStart('')
                      setEnd('')
                    }}
                    className="h-9"
                  >
                    취소
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ===== /최상단 오버레이 모달 ===== */}
      </CardContent>
    </Card>
  )
}

export default DownloadButtons
