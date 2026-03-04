import { useEffect, useMemo, useRef, useState } from 'react'
import GSSLogo from '@/assets/GSS_Logo.png'

type WhiteHeaderProps = {
  buildingName?: string
}

const WhiteHeader = ({ buildingName }: WhiteHeaderProps) => {
  const [buildingLogoUrl, setBuildingLogoUrl] = useState<string | null>(null)

  // S3 기본 경로
  const BASE = 'https://gssiot-image-bucket.s3.us-east-1.amazonaws.com'
  const FOLDER_RAW = '로고' // 한글 폴더
  const exts = ['png', 'jpg', 'jpeg', 'webp', 'svg']

  // ✅ 실패 URL 캐시: 한 번 실패한 URL은 다시 시도하지 않음
  const failedUrlSetRef = useRef<Set<string>>(new Set())

  // ✅ 여러 번 effect가 돌 때 이전 로딩 루프를 중단시키기 위한 토큰
  const inflightTokenRef = useRef(0)

  // 파일명 변형(공백/플러스/퍼센트 인코딩 모두 고려)
  const nameVariants = useMemo(() => {
    if (!buildingName) return []
    const raw = buildingName.trim()
    return [
      raw, // "호계동 현장"
      raw.replace(/ /g, '+'), // "호계동+현장"
      encodeURIComponent(raw), // "호계동%20현장"
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
      new Promise<boolean>(resolve => {
        const im = new Image()

        const done = (ok: boolean) => {
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
            if (cancelled || inflightTokenRef.current !== myToken) return

            const url = `${BASE}/${folder}/${name}.${ext}`

            if (failedUrlSetRef.current.has(url)) continue

            const ok = await loadImage(url)

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

      setBuildingLogoUrl(null)
    }

    tryLoad()

    return () => {
      cancelled = true
    }
  }, [BASE, exts, folderVariants, nameVariants])

  return (
    <header
      className={`
        w-full bg-[#F9FAFB] border-b border-gray-300 shadow-sm
        grid grid-cols-3 items-center
        px-2 sm:px-3 md:px-6
        py-1.5 md:py-2
        min-h-[56px] md:min-h-[72px]
        overflow-x-hidden
      `}
    >
      {/* 왼쪽: 빌딩 로고 */}
      <div className="flex justify-start items-center min-w-0">
        {buildingLogoUrl ? (
          <img
            src={buildingLogoUrl}
            alt={`${buildingName ?? ''} 로고`}
            className={`
              object-contain
              w-20 sm:w-10 md:w-16 h-auto
              ml-[-12px] sm:ml-1 md:ml-[20%]
              scale-110 md:scale-[4.5] 2xl:scale-[5.5]
              max-w-full
            `}
            onError={e => {
              const img = e.currentTarget as HTMLImageElement
              const cur = img.currentSrc || img.src
              if (cur) failedUrlSetRef.current.add(cur)
              setBuildingLogoUrl(null)
            }}
          />
        ) : (
          // ✅ 모바일에서 좌측이 너무 비면 레이아웃이 흔들릴 수 있어서 최소 자리 유지용(필요없으면 제거)
          <div className="w-8 sm:w-10 md:w-16" />
        )}
      </div>

      {/* 가운데: 타이틀 */}
      <div className="flex flex-col justify-center items-center text-center min-w-0 px-1">
        <h1
          className={`
            text-gray-800 font-[Giants] leading-tight
            text-[14px] sm:text-[16px] md:text-2xl
            truncate
          `}
          title="비계전도 감시 시스템"
        >
          폼변형 감지 시스템
        </h1>
      </div>

      {/* 오른쪽: GSS 로고 + 텍스트 */}
      <div className="flex justify-end items-center gap-1.5 sm:gap-2 md:gap-5 2xl:gap-10 min-w-0">
        <img
          src={GSSLogo}
          alt="GSS Logo"
          className={`
            object-contain
            w-20 sm:w-8 md:w-14 h-auto
            mr-[-15px]
            scale-110 md:scale-[2.5] 2xl:scale-[3.5]
            flex-shrink-0
          `}
        />

        {/* ✅ 모바일에서 너무 길면 줄바꿈/오버플로우 나서 숨김(또는 축약) */}
        <span
          className={`
            text-gray-700 font-[Giants] whitespace-nowrap
            text-[11px] sm:text-[12px] md:text-[90%] 2xl:text-[110%]
            hidden sm:inline
            truncate
          `}
          title="글로벌스마트솔루션"
        >
          글로벌스마트솔루션
        </span>
      </div>
    </header>
  )
}

export default WhiteHeader