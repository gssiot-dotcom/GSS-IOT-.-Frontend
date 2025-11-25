/* eslint-disable @typescript-eslint/no-explicit-any */
import { officeGatewaySchema } from '@/lib/vatidation'
import { createGatewayRequest, createOfficeGatewayRequest } from '@/services/apiRequests'
import { ICreateGateway, INode } from '@/types/interfaces'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
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

/** ✅ 게이트웨이 단독 생성 전용 스키마 (serial_number + zone_name) */
const createGatewaySimpleSchema = z.object({
  serial_number: z.string().min(1, '게이트웨이 번호를 입력하세요.'),
  zone_name: z.string().min(1, '구역 이름을 입력하세요.'),
})

interface GatewayFormProps {
  nodes: INode[]
  refetch: () => void
}

/** =========================
 *  게이트웨이 생성 (노드 입력 제거)
 *  ========================= */
const GatewayForm = ({ /* nodes, */ refetch }: GatewayFormProps) => {
  const form = useForm<z.infer<typeof createGatewaySimpleSchema>>({
    resolver: zodResolver(createGatewaySimpleSchema),
  })

  const onSubmit = async (values: z.infer<typeof createGatewaySimpleSchema>) => {
    try {
      const { serial_number, zone_name } = values

      // 🔸 ICreateGateway 타입에 zone_name?: string 추가하는 걸 추천!
      const sendingData: ICreateGateway & { zone_name: string } = {
        serial_number,
        nodes: [],          // 노드는 사용 안 해서 빈 배열
        zone_name,          // 👉 새로 추가된 필드
      }

      const resPromise = createGatewayRequest(sendingData)
      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res) => {
          setTimeout(() => {
            form.reset()
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
    <div className="md:w-[40%] flex justify-center items-center flex-col md:text-lg text-sm text-gray-500">
      <h1 className="leading-none text-xl font-bold text-gray-700 pb-2 mb-5 underline underline-offset-4">
        게이트웨이 생성
      </h1>

      <Form {...form}>
        <form
          className="w-full h-auto p-4 pb-8 border bg-white rounded-lg shadow-lg shadow-gray-300 space-y-3"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <h4 className="text-center capitalize mb-4">스마트가드 게이트웨이 No.</h4>

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
 *  사무실용 게이트웨이 생성 (기존 유지)
 *  ========================= */
export const OfficeGatewayForm = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const form = useForm<z.infer<typeof officeGatewaySchema>>({
    resolver: zodResolver(officeGatewaySchema),
  })

  const onSubmit = async (values: z.infer<typeof officeGatewaySchema>) => {
    setIsLoading(true)
    try {
      const { serial_number } = values
      const sendingData = {
        serial_number,
        gateway_type: 'OFFICE_GATEWAY',
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
