/* eslint-disable @typescript-eslint/no-explicit-any */
// api.ts
import {
	AngleNodeCreate,
	IClient,
	ICreateBuilding,
	ICreateClient,
	ICreateGateway,
	ICreateNode,
	ILogin,
	IRegisterUser,
	IResetPasswordStep1,
	IResetPasswordStep2,
	IUpdateProductStatus,
	IUpdateUserType,
	VerticalNodeCreate,
} from '@/types/interfaces'
import axios from 'axios'

//  ============= USER related requests ============ //
export const registerRequest = async (signupData: IRegisterUser) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/register`,
			signupData,
			{
				withCredentials: true,
			}
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on login: Undefined error')
		}

		return data
	} catch (err: any) {
		console.error(`ERROR ::: registerRequest ${err.message}`)
		throw err
	}
}

export const loginRequest = async (user: ILogin) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/api/auth/login`,
			user,
			{
				withCredentials: true,
			}
		)

		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on login')
		}

		return data
	} catch (error: any) {
		// Axios error qayta ishlash
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on login')
		}
		// Boshqa xatolik
		throw new Error(error.message || 'Error on login: Undefined error.')
	}
}

export const logoutRequest = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/logout`,
			{ withCredentials: true }
		)
		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message)
		}
		return true
	} catch (error: any) {
		throw new Error(error.message || 'Error on logout: undefined error')
	}
}

export const resetPasswordRequest = async (user_email: IResetPasswordStep1) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/reset-password`,
			user_email,
			{
				withCredentials: true,
			}
		)

		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on reset-password')
		}

		return data
	} catch (error: any) {
		// Axios error qayta ishlash
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on reset-password')
		}
		// Boshqa xatolik
		throw new Error(
			error.message || 'Error on reset-password: Undefined error.'
		)
	}
}

export const resetPasswordVerifyRequest = async (
	resetData: IResetPasswordStep2
) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/password-verify`,
			resetData,
			{
				withCredentials: true,
			}
		)

		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on reset-password')
		}

		return data
	} catch (error: any) {
		// Axios error qayta ishlash
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on reset-password')
		}
		// Boshqa xatolik
		throw new Error(
			error.message || 'Error on reset-password: Undefined error.'
		)
	}
}

//  Hali ishlatilmadi auth prodiver da.
// export const checkUser = async () => {
// 	try {
// 		const response = await axios.get(`$/auth/user`, {
// 			withCredentials: true,
// 		})
// 		const user = response.data
// 		return user
// 	} catch (error: any) {
// 		throw new Error(
// 			error.response?.data?.message || 'Error on connecting to server.'
// 		)
// 	}
// }

export const getUsers = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/get-users`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on login: Undefined error')
		}
		return data.users
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

export const updateUserTypes = async (updateData: IUpdateUserType) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/update-user-types`,
			updateData,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on updating-user: Undefined error')
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

export const deleteUser = async (user_id: string) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/delete-user`,
			{ user_id },
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on deleting-user: Undefined error')
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

//  ============= PRODUCT related requests ============ //

export const getGateways = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/get-gateways`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on getting-gateways: Undefined error'
			)
		}
		return data.gateways
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}
export const getActiveGateways = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/get-active-gateways`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on getting-gateways: Undefined error'
			)
		}
		return data.gateways
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}
export const getSingleGateway = async (gatewayNumber: string) => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL
			}/product/get-single-gateway/${gatewayNumber}`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on getting-gateways: Undefined error'
			)
		}
		return data.gateway
	} catch (error: any) {
		// ❗ Faqat throw qilish
		throw new Error(
			error.response?.data?.message || 'Serverda xatolik yuz berdi'
		)
	}
}
export const getNodes = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/get-nodes`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on getting-Nodes: Undefined error')
		}
		return data.nodes
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}
export const getActiveNodes = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/get-active-nodes`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on getting-Nodes: Undefined error')
		}
		return data.nodes
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}
export const createNodeRequest = async (nodes: ICreateNode[]) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/create-nodes`,
			nodes,
			{
				withCredentials: true,
			}
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		// Axios error handling
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		// Other errors
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}
export const createGatewayRequest = async (gateway: ICreateGateway) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/create-gateway`,
			gateway,
			{
				withCredentials: true,
			}
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		// Axios error handling
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		// Other errors
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}
export const createOfficeGatewayRequest = async (data: any) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/create-office-gateway`,
			data,
			{
				withCredentials: true,
			}
		)
		const result = res.data

		if (result.state === 'fail') {
			throw new Error(result.message || 'Error on creating node')
		}

		return result
	} catch (error: any) {
		// Axios error handling
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		// Other errors
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}
export const createAngleNodeRequest = async (nodes: AngleNodeCreate[]) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/create-angle-nodes`,
			nodes,
			{
				withCredentials: true,
			}
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		// Axios error handling
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		// Other errors
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

export const createVerticalNodeRequest = async (
	nodes: VerticalNodeCreate[]
) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/api/vertical-nodes/`,
			nodes,
			{
				withCredentials: true,
			}
		)

		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating vertical nodes')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(
				error.response.data.message || 'Error on creating vertical nodes'
			)
		}

		throw new Error(
			error.message || 'Error on creating vertical nodes: Undefined error.'
		)
	}
}

export const connectAngleNodesRequest = async (sendingData: any) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/api/angle-node/combine/to-gateway`,
			sendingData,
			{
				withCredentials: true,
			}
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		// Axios error handling
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		// Other errors
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

export const connectNodesRequest = async (sendingData: any) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/api/node/combine/to-gateway`,
			sendingData,
			{
				withCredentials: true,
			}
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		// Axios error handling
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		// Other errors
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

export const updateProductStatus = async (updateData: IUpdateProductStatus) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product${updateData.product_endpoint
			}`,
			{
				product_type: updateData.product_type,
				product_id: updateData.product_id,
			},
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on updating-user: Undefined error')
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}
export const deleteProduct = async (deleteData: IUpdateProductStatus) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product${deleteData.product_endpoint
			}`,
			{
				product_type: deleteData.product_type,
				product_id: deleteData.product_id,
			},
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on deleting-user: Undefined error')
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}
export const NodePositionRequest = async (FormData: FormData) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/set-node-position`,
			FormData,
			{
				withCredentials: true,
			}
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on node-positioning: Undefined error'
			)
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

//  ============= PRODUCT related requests ============ //

//  ============= CLIENT related requests ============ //

export const createBuildingRequest = async (buildingData: ICreateBuilding) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/create-building`,
			buildingData,
			{
				withCredentials: true,
			}
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		// Axios error handling
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		// Other errors
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

export const createClientRequest = async (clientData: ICreateClient) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/create-client`,
			clientData,
			{
				withCredentials: true,
			}
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		// Axios error handling
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		// Other errors
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

// apiRequests.ts 제일 아래쪽 아무 데나 추가

export const changeGatewayBuildingRequest = async (params: {
	gateway_id: string
	building_id: string
}) => {
	try {
		const res = await axios.post(
			'/api/company/building/change-gateway-building',
			{
				gateway_id: params.gateway_id,
				building_id: params.building_id,
			},
			{
				baseURL: import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005',
				withCredentials: true,
			}
		)

		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on changing gateway building')
		}

		return data
	} catch (error: any) {
		throw new Error(
			error.response?.data?.message ||
			error.message ||
			'Error on changing gateway building: Undefined error.'
		)
	}
}


export const getActiveBuildings = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/get-active-buildings`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on getting-Nodes: Undefined error')
		}
		return data.buildings
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

export const getBuildings = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/get-buildings`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on getting-buildings: Undefined error'
			)
		}
		return data.buildings
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

export const fetchClients = async (): Promise<IClient[]> => {
	try {
		// await new Promise(resolve => setTimeout(resolve, 500))

		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/clients`,
			{ withCredentials: true }
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data.clients
	} catch (error: any) {
		// Xatoni React Queryga yuborish uchun qayta o'rash
		throw new Error(
			error.response?.data?.message ||
			'Server bilan bog‘lanishda xatolik yuz berdi'
		)
	}
}

export const deleteClient = async (clintId: string) => {
	try {
		const res = await axios.delete(
			`${import.meta.env.VITE_SERVER_BASE_URL
			}/company/delete/client/${clintId}`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on deleting-Client: Undefined error'
			)
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

export const fetchClientBuildings = async (clientId: string | undefined) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/clients/${clientId}`,
			{ withCredentials: true }
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		return new Error(
			error.response?.data?.message || 'Error on fetching client data.'
		)
	}
}

export const deleteBuilding = async (buildngId: string) => {
	try {
		const res = await axios.delete(
			`${import.meta.env.VITE_SERVER_BASE_URL
			}/company/delete/building/${buildngId}`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on deleting-bulding: Undefined error'
			)
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

export const fetchBuildingNodes = async (buildingId: string) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/buildings/${buildingId}`,
			{ withCredentials: true }
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		return new Error(
			error.response?.data?.message || 'Error on fetching building nodes.'
		)
	}
}

//  ============= CLIENT creating related requests ============ //

//  ============= CLIENT-Boss type user related requests ============ //

export const fetchBossClients = async (userId: string): Promise<IClient[]> => {
	try {
		// await new Promise(resolve => setTimeout(resolve, 500))
		const response = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/boss-clients`,
			{ userId },
			{ withCredentials: true }
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data.clients
	} catch (error: any) {
		// Xatoni React Queryga yuborish uchun qayta o'rash
		throw new Error(
			error.response?.data?.message ||
			'Server bilan bog‘lanishda xatolik yuz berdi'
		)
	}
}

export const fetchClientBossBuildings = async (
	clientId: string | undefined
) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/client/boss/${clientId}`,
			{ withCredentials: true }
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		return new Error(
			error.response?.data?.message || 'Error on fetching client data.'
		)
	}
}

//  ============= Angle-Nodes related requests ============ //

export const getActiveAngleNodes = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/get-active-angle-nodes`,
			{ withCredentials: true }
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on getting-Nodes: Undefined error')
		}
		return data.angle_nodes
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

export const fetchBuildingAngleNodes = async (buildingId: string) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL
			}/company/buildings/${buildingId}/angle-nodes`,
			{ withCredentials: true }
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		return new Error(
			error.response?.data?.message || 'Error on fetching building angle-nodes.'
		)
	}
}

export const getAngleNodeSummary = async (buildingId: string) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL
			}/company/buildings/${buildingId}/angle-nodes/summary`,
			{ withCredentials: true }
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data.angle_nodes
	} catch (error: any) {
		return new Error(
			error.response?.data?.message || 'Error on fetching building angle-nodes.'
		)
	}
}


// apiRequests.ts
export const setBuildingAlarmLevelRequest = async (
	buildingId: string,
	levels: { B: number; G: number; Y: number; R: number }
) => {
	try {
		const res = await axios.put(
			'/company/building/set-alarm-level',
			{
				building_id: buildingId,
				alarmLevel: {
					blue: levels.B,
					green: levels.G,
					yellow: levels.Y,
					red: levels.R,
				},
			},
			{
				baseURL: import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005',
				withCredentials: true,
			}
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on setting alarm level')
		}
		return data
	} catch (error: any) {
		throw new Error(
			error.response?.data?.message ||
			error.message ||
			'Error on setting alarm level: Undefined error.'
		)
	}
}

export const getAngleAliveNodes = async () => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_SERVER_BASE_URL}/api/angle-nodes/alive`,
      { withCredentials: true }
    )

    const data = res.data
    // 이 API는 배열을 바로 내려줌: [{doorNum,...}, ...]
    if (!Array.isArray(data)) {
      throw new Error('Invalid response format from /angle-nodes/alive')
    }

    return data
  } catch (error: any) {
    throw new Error(error.message || 'Error on connecting to server.')
  }
}

export const getVerticalNodesRequest = async () => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_SERVER_BASE_URL}/api/vertical-nodes/`,
      { withCredentials: true }
    )

    const data = res.data

    if (data?.state === 'fail') {
      throw new Error(data.message || 'Error on getting vertical nodes')
    }

    return data
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw new Error(
        error.response.data.message || 'Error on getting vertical nodes'
      )
    }
    throw new Error(
      error.message || 'Error on getting vertical nodes: Undefined error.'
    )
  }
}

// ✅ 게이트웨이 타입별 조회 (type=GATEWAY만 드롭다운에 쓸거)
export const getGatewaysByTypeRequest = async () => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_SERVER_BASE_URL}/api/gateway/get-gateways-bytype`,
      { withCredentials: true }
    )

    const data = res.data
    if (data.state === 'fail') {
      throw new Error(data.message || 'Error on getting gateways by type')
    }

    // ✅ Postman 응답: { gateways: { GATEWAY: [...], VERTICAL_NODE_GATEWAY: [...] } }
    return data.gateways?.GATEWAY ?? []
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message ||
        error.message ||
        'Error on getting gateways by type: Undefined error.'
    )
  }
}

// ✅ Vertical Node Gateway 목록 가져오기
export const getVerticalNodeGatewaysByTypeRequest = async () => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_SERVER_BASE_URL}/api/gateway/get-gateways-bytype`,
      { withCredentials: true }
    )

    const data = res.data
    if (data.state === 'fail') {
      throw new Error(data.message || 'Error on getting gateways by type')
    }

    // ✅ Postman 응답: gateways.VERTICAL_NODE_GATEWAY 배열
    return data.gateways?.VERTICAL_NODE_GATEWAY ?? []
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message ||
        error.message ||
        'Error on getting vertical node gateways by type: Undefined error.'
    )
  }
}

// ✅ 전체 타입 active 노드 조회
export const getAllTypeActiveNodesRequest = async () => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_SERVER_BASE_URL}/api/node/get-alltype-active-nodes`,
      { withCredentials: true }
    )

    const data = res.data
    if (data.state === 'fail') {
      throw new Error(data.message || 'Error on getting active nodes')
    }

    // { state: "success", nodes: { nodes: [], angle_nodes: [], vertical_nodes: [] } }
    return data.nodes
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message ||
        error.message ||
        'Error on getting active nodes: Undefined error.'
    )
  }
}
