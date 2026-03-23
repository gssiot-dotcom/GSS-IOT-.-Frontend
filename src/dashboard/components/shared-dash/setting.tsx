'use client'

import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SettingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenInit: () => void
  onOpenPlanUpload: () => void   // ✅ 전체 도면
  onOpenNodeImgUpload: () => void // ✅ 노드 도면
}

const SettingModal = ({
  open,
  onOpenChange,
  onOpenInit,
  onOpenPlanUpload,
  onOpenNodeImgUpload,
}: SettingModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 bg-gray/50 z-[100]" />
        <DialogContent className="z-[100] max-w-md">
          <DialogHeader>
            <DialogTitle>설정</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3">
            {/* 노드 초기화 */}
            <button
              className="px-3 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600"
              onClick={() => {
                onOpenChange(false)
                onOpenInit()
              }}
            >
              노드 초기화
            </button>

            {/* 전체 도면 업로드 */}
            <button
              className="px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
              onClick={() => {
                onOpenChange(false)
                onOpenPlanUpload()
              }}
            >
              전체 도면 업로드
            </button>

            {/* 노드 도면 업로드 */}
            <button
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
              onClick={() => {
                onOpenChange(false)
                onOpenNodeImgUpload()
              }}
            >
              노드 도면 업로드
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

export default SettingModal