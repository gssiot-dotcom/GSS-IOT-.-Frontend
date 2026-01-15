/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getAllTypeActiveNodesRequest } from '@/services/apiRequests'
import { Checkbox } from '../ui/checkbox'
import { ScrollArea } from '../ui/scroll-area'

type NodeTypeKey = 'nodes' | 'angle_nodes' | 'vertical_nodes'

type AnyNode = {
    _id: string
    doorNum?: number
    node_number?: number
    node_status?: boolean
}

const LABELS: Record<NodeTypeKey, string> = {
    nodes: '비계전도',
    vertical_nodes: '수직노드',
    angle_nodes: '해치발판',
}

function getNodeNumber(n: AnyNode): number | null {
    return (
        (typeof n.node_number === 'number' && n.node_number) ||
        (typeof n.doorNum === 'number' && n.doorNum) ||
        null
    )
}

export default function NodeStatusForm() {
    const [selectedType, setSelectedType] = useState<NodeTypeKey>('nodes')

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['alltype-active-nodes'],
        queryFn: getAllTypeActiveNodesRequest,
        refetchOnWindowFocus: false,
        retry: 1,
    })

    const activeNumbers = useMemo(() => {
        const list: AnyNode[] = (data?.[selectedType] as AnyNode[]) ?? []
        const filtered = list.filter((n) => n?.node_status === true)

        const nums = filtered
            .map(getNodeNumber)
            .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))

        return Array.from(new Set(nums)).sort((a, b) => a - b)
    }, [data, selectedType])

    return (
        <div className="w-full min-w-[1200px] flex flex-col">
            {/* ✅ 제목 + 체크박스 오른쪽 정렬 */}
            <div className="flex flex-col items-end mb-3">
                {/* 체크박스 라인을 기준으로 제목을 수직노드 위에 띄우기 */}
                <div className="relative">
                    {/* ✅ 제목: 수직노드 체크박스 위 */}
                    <h2 className="absolute -top-12 left-1/2 -translate-x-1/2 text-xl font-semibold underline underline-offset-4">
                        사용가능노드
                    </h2>

                    {/* ✅ 체크박스 라인 */}
                    <div className="flex items-center gap-9 text-sm">
                        {(Object.keys(LABELS) as NodeTypeKey[]).map((key) => (
                            <label
                                key={key}
                                className="flex items-center gap-2 cursor-pointer select-none"
                            >
                                <Checkbox
                                    checked={selectedType === key}
                                    onCheckedChange={(checked) => {
                                        if (checked) setSelectedType(key)
                                    }}
                                />
                                <span className={selectedType === key ? 'font-semibold' : 'text-gray-600'}>
                                    {LABELS[key]}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            {/* ✅ 번호 박스 */}
            <div className="w-full mt-0 rounded-xl bg-white border border-gray-300 p-[8.6vh]">
                {isLoading ? (
                    <div className="text-sm text-gray-600">불러오는 중...</div>
                ) : isError ? (
                    <div className="text-sm text-red-600">
                        {(error as any)?.message ?? '데이터를 불러오지 못했습니다.'}
                    </div>
                ) : activeNumbers.length === 0 ? (
                    <div className="text-sm text-gray-600">Not Found</div>
                ) : (
                    <>
                        <div className="text-xs text-gray-600 mb-2">
                            {LABELS[selectedType]} · 총 {activeNumbers.length}개 (status=true)
                        </div>

                        <ScrollArea className="h-40 w-full rounded-md">
                            <div className="flex flex-wrap gap-2">
                                {activeNumbers.map((num) => (
                                    <span
                                        key={num}
                                        className="px-2 py-1 rounded-md bg-white border border-gray-300 text-sm text-gray-800"
                                    >
                                        {num}
                                    </span>
                                ))}
                            </div>
                        </ScrollArea>
                    </>
                )}
            </div>
        </div>
    )
}
