import { loginSchema } from '@/lib/vatidation'
import { loginRequest } from '@/services/apiRequests'
import { useAuthState } from '@/stores/auth.store'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import FillLoading from '../shared/fill-laoding'
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

const Login = () => {
  const { setAuth } = useAuthState()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { user_email: '', user_password: '' },
  })

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true)

    try {
      const resPromise = loginRequest(values)

      toast.promise(resPromise, {
        loading: 'Loading...',
        success: (res: any) => {
          if (res.state === 'success') {
            setError('')
            setTimeout(() => {
              window.location.reload()
            }, 1000)
            return 'Login successfully!'
          }
          // 텔레그램 연동 분기 제거: 성공 외 상태는 에러로 처리
          throw new Error('Unexpected response structure')
        },
        error: (err: any) => {
          setIsLoading(false)
          console.error('Error:', err)
          const errorMessage = err?.message || 'Something went wrong'
          setError(errorMessage)
          return errorMessage
        },
      })
    } catch (error) {
      const result = error as Error
      setError(result.message)
      setIsLoading(false)
    }
  }

  return (
    <div className='flex flex-col text-secondary'>
      <h2 className='text-xl font-bold'>Login</h2>

      <div className='flex justify-start flex-col space-y-2'>
        <p>
          Don't have an account?{' '}
          <span
            className='cursor-pointer underline underline-offset-4'
            onClick={() => setAuth('register')}
          >
            Sign up
          </span>
        </p>
        <p>
          forgot password?{' '}
          <span
            className='cursor-pointer underline underline-offset-4'
            onClick={() => setAuth('reset-password')}
          >
            reset-password
          </span>
        </p>
      </div>

      {error && (
        <Alert className='text-red-600 py-2 mt-2' variant='default'>
          <AlertCircle className='h-4 w-4' color='red' />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-8 mt-5 relative'
        >
          {/* 로딩 오버레이 */}
          {isLoading && (
            <div className='absolute inset-0 flex items-center justify-center z-10'>
              <FillLoading />
            </div>
          )}

          {/* Email Field */}
          <FormField
            control={form.control}
            name='user_email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    placeholder='example@gmail.com'
                    disabled={isLoading}
                    {...field}
                    className='placeholder:text-white/75 text-white bg-transparent'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name='user_password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder='****'
                    disabled={isLoading}
                    {...field}
                    className='placeholder:text-white/75 text-white bg-transparent'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Button
              type='submit'
              className='h-12 w-full mt-2'
              disabled={isLoading}
            >
              Submit
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export default Login
