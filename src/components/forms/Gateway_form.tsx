/* eslint-disable @typescript-eslint/no-explicit-any */
import { officeGatewaySchema } from '@/lib/vatidation'
import {
  createGatewayRequest,
  createOfficeGatewayRequest,
  getGateways, // ✅ 기존에 있는 게이트웨이 목록 API 사용
} from '@/services/apiRequests'
import { ICreateGateway, INode } from '@/types/interfaces'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form'
import { Input } from '../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

/** ✅ gateway_type 유니온 */
const gatewayTypeEnum = z.enum(['GATEWAY', 'VERTICAL_NODE_GATEWAY', 'OFFICE_GATEWAY'])

/** ✅ 게이트웨이 단독 생성 전용 스키마 (serial_number + zone_name + gateway_type) */
const createGatewaySimpleSchema = z.object({
  serial_number: z.string().min(1, '게이트웨이 번호를 입력하세요.'),
  zone_name: z.string().min(1, '구역 이름을 입력하세요.'),
  gateway_type: gatewayTypeEnum,
})

interface GatewayFormProps {
  nodes: INode[]
  refetch: () => void
}

/** =========================
 *  게이트웨이 생성 (번호 + 구역 + 타입)
 *  + 우상단 드롭다운: 게이트웨이 serial_number 목록 확인(보기 전용)
 *  ========================= */
const GatewayForm = ({ /* nodes, */ refetch }: GatewayFormProps) => {
  const form = useForm<z.infer<typeof createGatewaySimpleSchema>>({
    resolver: zodResolver(createGatewaySimpleSchema),
    defaultValues: {
      serial_number: '',
      zone_name: '',
      gateway_type: 'GATEWAY',
    },
  })

  // ✅ 드롭다운용 게이트웨이 시리얼 목록 상태
  const [gatewaySerials, setGatewaySerials] = useState<string[]>([])
  const [gwLoading, setGwLoading] = useState(false)
  const [gwError, setGwError] = useState('')

  const sortedSerials = useMemo(() => {
    return [...gatewaySerials].sort((a, b) => {
      const an = Number(a)
      const bn = Number(b)
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn
      return a.localeCompare(b)
    })
  }, [gatewaySerials])

  const fetchGatewaySerials = async () => {
    setGwLoading(true)
    setGwError('')
    try {
      const gateways = await getGateways()
      const serials = (gateways ?? [])
        .map((g: any) => g.serial_number)
        .filter(Boolean)

      setGatewaySerials(serials)
    } catch (e: any) {
      setGwError(e.message || '게이트웨이 목록을 불러오지 못했습니다.')
    } finally {
      setGwLoading(false)
    }
  }

  const onSubmit = async (values: z.infer<typeof createGatewaySimpleSchema>) => {
    try {
      const { serial_number, zone_name, gateway_type } = values

      // ✅ ICreateGateway에 gateway_type 추가해두는 걸 권장 (현재는 확장 타입으로 처리)
      const sendingData: ICreateGateway & {
        zone_name: string
        gateway_type: 'GATEWAY' | 'VERTICAL_NODE_GATEWAY' | 'OFFICE_GATEWAY'
      } = {
        serial_number,
        nodes: [],
        zone_name,
        gateway_type,
      }

      const resPromise = createGatewayRequest(sendingData)
      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res) => {
          setTimeout(() => {
            form.reset({
              serial_number: '',
              zone_name: '',
              gateway_type: 'GATEWAY',
            })
            refetch()
          }, 1000)
          return res.message
        },
        error: (err) => err.message || 'Something went wrong :(',
      })
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong :(')
    }
  }

  return (
    <div className="w-full flex justify-center items-center flex-col md:text-lg text-sm text-gray-500">
      <Form {...form}>
        <form
          className="w-full h-auto p-4 pb-8 border bg-white rounded-lg shadow-lg shadow-gray-300 space-y-3 relative"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* ✅ 우상단: 게이트웨이 목록 드롭다운(시리얼만) */}
          <div className="absolute top-3 right-3">
            <DropdownMenu
              onOpenChange={(open) => {
                // 열릴 때만 최신 목록 fetch
                if (open) fetchGatewaySerials()
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-8 px-2 text-xs">
                  게이트웨이 목록 <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Serial Numbers</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {gwLoading && (
                  <div className="px-2 py-2 text-xs text-gray-500">불러오는 중...</div>
                )}

                {!gwLoading && gwError && (
                  <div className="px-2 py-2 text-xs text-red-600">{gwError}</div>
                )}

                {!gwLoading && !gwError && sortedSerials.length === 0 && (
                  <div className="px-2 py-2 text-xs text-gray-500">게이트웨이가 없습니다.</div>
                )}

                {!gwLoading && !gwError && sortedSerials.length > 0 && (
                  <div className="max-h-60 overflow-auto">
                    {sortedSerials.map((sn) => (
                      <DropdownMenuItem key={sn} className="text-sm">
                        {sn}
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h4 className="text-center capitalize mb-4">스마트가드 게이트웨이 생성</h4>

          {/* 게이트웨이 번호 */}
          <FormField
            control={form.control}
            name="serial_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>게이트웨이 No.</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="border-gray-700 focus:border-transparent"
                    placeholder="예: 0003"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 구역 이름 */}
          <FormField
            control={form.control}
            name="zone_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>구역 이름</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="border-gray-700 focus:border-transparent"
                    placeholder="예: 1구역, 옥상 A동"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 게이트웨이 타입 */}
          <FormField
            control={form.control}
            name="gateway_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>게이트웨이 타입</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="border-gray-700 focus:border-transparent">
                      <SelectValue placeholder="타입을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GATEWAY">GATEWAY</SelectItem>
                      <SelectItem value="VERTICAL_NODE_GATEWAY">VERTICAL_NODE_GATEWAY</SelectItem>
                      <SelectItem value="OFFICE_GATEWAY">OFFICE_GATEWAY</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-12 w-full mt-2">
            게이트웨이 생성
          </Button>
        </form>
      </Form>
    </div>
  )
}

export default GatewayForm

/** =========================
 *  사무실용 게이트웨이 생성 (OFFICE_GATEWAY 고정)
 *  ========================= */
export const OfficeGatewayForm = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const form = useForm<z.infer<typeof officeGatewaySchema>>({
    resolver: zodResolver(officeGatewaySchema),
    defaultValues: {
      serial_number: '',
    },
  })

  const onSubmit = async (values: z.infer<typeof officeGatewaySchema>) => {
    setIsLoading(true)
    try {
      const { serial_number } = values

      const sendingData = {
        serial_number,
        gateway_type: 'OFFICE_GATEWAY' as const,
      }

      const resPromise = createOfficeGatewayRequest(sendingData)
      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res) => {
          setError('')
          setTimeout(() => {
            setIsLoading(false)
            form.reset({ serial_number: '' })
          }, 1000)
          return res.message
        },
        error: (err) => {
          setIsLoading(false)
          setError(err.message)
          return err.message || 'Something went wrong :('
        },
      })
    } catch (error: any) {
      setIsLoading(false)
      toast.error(error.message || 'Something went wrong :(')
    }
  }

  return (
    <div className="w-full flex justify-center items-center flex-col md:text-lg text-sm text-gray-500">
      <h1 className="leading-none text-xl text-gray-700 font-bold pb-2 mb-5 underline underline-offset-4">
        사무실용 게이트웨이
      </h1>

      {isLoading && <p className="absolute inset-0">Loading...</p>}
      {error && (
        <Alert className="text-red-600 py-2 mt-2" variant="destructive">
          <AlertCircle className="h-4 w-4" color="red" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full h-auto p-4 border border-gray-200 bg-white rounded-lg shadow-lg shadow-gray-300 space-y-5"
        >
          <FormField
            control={form.control}
            name="serial_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>게이트웨이 No.</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="예: 0001"
                    disabled={isLoading}
                    {...field}
                    value={field.value ?? ''}
                    className="border-gray-700 focus:border-transparent placeholder:text-gray-400"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading} className="h-12 w-full mt-2">
            Submit
          </Button>
        </form>
      </Form>
    </div>
  )
}
