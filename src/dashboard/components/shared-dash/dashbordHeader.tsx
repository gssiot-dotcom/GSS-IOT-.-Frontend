import { useEffect, useMemo, useRef, useState } from "react"
import GSSLogo from "@/assets/GSS_Logo.png"

type WhiteHeaderProps = {
  buildingName?: string
}

const WhiteHeader = ({ buildingName }: WhiteHeaderProps) => {
  const [buildingLogoUrl, setBuildingLogoUrl] = useState<string | null>(null)

  // S3 기본 경로
  const BASE = "https://gssiot-image-bucket.s3.us-east-1.amazonaws.com"
  const FOLDER_RAW = "로고" // 한글 폴더
  const exts = ["png", "jpg", "jpeg", "webp", "svg"]

  // ✅ 실패 URL 캐시: 한 번 실패한 URL은 다시 시도하지 않음
  const failedUrlSetRef = useRef<Set<string>>(new Set())

  // ✅ 여러 번 effect가 돌 때 이전 로딩 루프를 중단시키기 위한 토큰
  const inflightTokenRef = useRef(0)

  // 파일명 변형(공백/플러스/퍼센트 인코딩 모두 고려)
  const nameVariants = useMemo(() => {
    if (!buildingName) return []
    const raw = buildingName.trim()
    return [
      raw,                      // "호계동 현장"
      raw.replace(/ /g, "+"),   // "호계동+현장"
      encodeURIComponent(raw),  // "호계동%20현장"
    ]
  }, [buildingName])

  // 폴더도 인코딩/비인코딩 모두 시도
  const folderVariants = useMemo(() => {
    const enc = encodeURIComponent(FOLDER_RAW)
    return [FOLDER_RAW, enc]
  }, [])

  // ✅ (선택) 빌딩명이 바뀌면 이전 실패 캐시를 비우고 새 로고를 다시 찾게 함
  useEffect(() => {
    failedUrlSetRef.current.clear()
    setBuildingLogoUrl(null)
  }, [buildingName])

  // <img> 프리로드로 실제로 열리는 첫 URL만 채택
  useEffect(() => {
    if (!nameVariants.length) {
      setBuildingLogoUrl(null)
      return
    }

    const myToken = ++inflightTokenRef.current
    let cancelled = false

    const loadImage = (url: string) =>
      new Promise<boolean>((resolve) => {
        const im = new Image()

        const done = (ok: boolean) => {
          // 이벤트 핸들러 정리 (메모리/누수 방지)
          im.onload = null
          im.onerror = null
          resolve(ok)
        }

        im.onload = () => done(true)
        im.onerror = () => done(false)
        im.src = url
      })

    const tryLoad = async () => {
      for (const folder of folderVariants) {
        for (const name of nameVariants) {
          for (const ext of exts) {
            // ✅ effect가 새로 시작되었거나 unmount면 즉시 중단
            if (cancelled || inflightTokenRef.current !== myToken) return

            const url = `${BASE}/${folder}/${name}.${ext}`

            // ✅ 실패 캐시에 있으면 건너뜀
            if (failedUrlSetRef.current.has(url)) continue

            const ok = await loadImage(url)

            // ✅ 중간에 취소됐으면 결과 무시
            if (cancelled || inflightTokenRef.current !== myToken) return

            if (ok) {
              setBuildingLogoUrl(url)
              return
            } else {
              failedUrlSetRef.current.add(url)
            }
          }
        }
      }

      // 전부 실패
      setBuildingLogoUrl(null)
    }

    tryLoad()

    return () => {
      cancelled = true
    }
  }, [BASE, exts, folderVariants, nameVariants])

  return (
    <header className="lg:w-[102%] 2xl:w-[102%] bg-[#F9FAFB] lg:py-1 2xl:py-2 border-b border-gray-300 shadow-sm grid grid-cols-3 items-center px-6 2xl:-ml-[0.1%]">
      {/* 왼쪽: 빌딩 로고 */}
      <div className="flex justify-start items-center">
        {buildingLogoUrl && (
          <img
            src={buildingLogoUrl}
            alt={`${buildingName ?? ""} 로고`}
            className="lg:ml-[20%] 2xl:ml-[17%] w-16 h-auto object-contain lg:scale-[4.5] 2xl:scale-[5.5]"
            onError={(e) => {
              // ✅ 혹시나 실제 렌더링 단계에서 실패해도(권한/일시 오류 등) 무한루프 방지
              const img = e.currentTarget as HTMLImageElement
              const cur = img.currentSrc || img.src
              if (cur) failedUrlSetRef.current.add(cur)
              setBuildingLogoUrl(null)
            }}
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
      <div className="flex justify-end items-center lg:gap-5 2xl:gap-10 lg:-mr-[2%] 2xl:-mr-[1%]">
        <img
          src={GSSLogo}
          alt="GSS Logo"
          className="w-14 h-auto object-contain lg:scale-[2.5] 2xl:scale-[3.5]"
        />
        <span className="text-gray-700 lg:text-[90%] 2xl:text-[110%] whitespace-nowrap font-[Giants]">
          글로벌스마트솔루션
        </span>
      </div>
    </header>
  )
}

export default WhiteHeader
