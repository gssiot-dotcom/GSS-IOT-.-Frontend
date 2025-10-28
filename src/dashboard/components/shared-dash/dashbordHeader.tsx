import { useEffect, useMemo, useState } from "react"
import GSSLogo from "@/assets/GSS_Logo.png"

type WhiteHeaderProps = {
  buildingName?: string
}

const WhiteHeader = ({ buildingName }: WhiteHeaderProps) => {
  const [buildingLogoUrl, setBuildingLogoUrl] = useState<string | null>(null)

  // S3 기본 경로
  const BASE = "https://gssiot-image-bucket.s3.us-east-1.amazonaws.com"
  const FOLDER_RAW = "로고" // 한글 폴더
  // 시도할 확장자
  const exts = ["png", "jpg", "jpeg", "webp", "svg"]

  // 파일명 변형(공백/플러스/퍼센트 인코딩 모두 고려)
  const nameVariants = useMemo(() => {
    if (!buildingName) return []
    const raw = buildingName.trim()
    return [
      raw,                         // "호계동 현장"
      raw.replace(/ /g, "+"),      // "호계동+현장"   (S3에 +로 올린 경우)
      encodeURIComponent(raw),     // "호계동%20현장" (표준 인코딩)
    ]
  }, [buildingName])

  // 폴더도 인코딩/비인코딩 모두 시도 (브라우저/업로드 방식 차이 대비)
  const folderVariants = useMemo(() => {
    const enc = encodeURIComponent(FOLDER_RAW) // "%EB%A1%9C%EA%B3%A0"
    return [FOLDER_RAW, enc]
  }, [])

  // <img> 프리로드로 실제로 열리는 첫 URL만 채택 (CORS 영향 적고 HEAD 미사용)
  useEffect(() => {
    let cancelled = false
    const tryLoad = async () => {
      for (const folder of folderVariants) {
        for (const name of nameVariants) {
          for (const ext of exts) {
            const url = `${BASE}/${folder}/${name}.${ext}`
            const ok = await new Promise<boolean>((resolve) => {
              const im = new Image()
              im.onload = () => resolve(true)
              im.onerror = () => resolve(false)
              im.src = url
            })
            if (ok) {
              if (!cancelled) setBuildingLogoUrl(url)
              return
            }
          }
        }
      }
      if (!cancelled) setBuildingLogoUrl(null) // 전부 실패
    }
    if (nameVariants.length) tryLoad()
    return () => { cancelled = true }
  }, [folderVariants, nameVariants])

  return (
    <header className="w-[102%] bg-[#F9FAFB] py-1 border-b border-gray-300 shadow-sm grid grid-cols-3 items-center px-6">
      {/* 왼쪽: 빌딩 로고 */}
      <div className="flex justify-start items-center">
        {buildingLogoUrl && (
          <img
            src={buildingLogoUrl}
            alt={`${buildingName ?? ""} 로고`}
            className="ml-[20%] w-16 h-auto object-contain scale-[4.5]"
          />
        )}
      </div>

      {/* 가운데: 타이틀 */}
      <div className="flex flex-col justify-center items-center text-center">
        <h1 className="text-gray-800 text-2xl font-[Giants] leading-none">
          비계전도 감시 시스템
        </h1>

      </div>

      {/* 오른쪽: GSS 로고 + 텍스트 */}
      <div className="flex justify-end items-center gap-5 -mr-[2%]">
        <img
          src={GSSLogo}
          alt="GSS Logo"
          className="w-14 h-auto object-contain scale-[2.5]"
        />
        <span className="text-gray-700 text-lg whitespace-nowrap font-[Giants]">
          글로벌스마트솔루션
        </span>
      </div>
    </header>

  )
}

export default WhiteHeader
