/* eslint-disable @typescript-eslint/no-explicit-any */
// api.ts

import {
	AngleNodeCreate,
	IClient,
	ICreateBuilding,
	ICreateClient,
	ICreateGateway,
	ICreateNode,
	IGateway,
	ILogin,
	IRegisterUser,
	IResetPasswordStep1,
	IResetPasswordStep2,
	IUpdateProductStatus,
	IUpdateUserType,
	VerticalNodeCreate,
} from '@/types/interfaces'
import axios from 'axios'

/**
 * =========================================
 * AUTH / USER
 * =========================================
 * - 로그인/로그아웃/회원가입
 * - 비밀번호 재설정
 * - 유저 관리(목록/권한 업데이트/삭제)
 */

/** 회원가입 */
export const registerRequest = async (signupData: IRegisterUser) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/register`,
			signupData,
			{ withCredentials: true },
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

/** 로그인 */
export const loginRequest = async (user: ILogin) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/login`,
			user,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on login')
		}

		return data
	} catch (error: any) {
		// Axios error 처리
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on login')
		}
		// 기타 에러
		throw new Error(error.message || 'Error on login: Undefined error.')
	}
}

/** 로그아웃 */
export const logoutRequest = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/logout`,
			{ withCredentials: true },
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

/** 비밀번호 재설정 Step1: 이메일 전송 */
export const resetPasswordRequest = async (user_email: IResetPasswordStep1) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/reset-password`,
			user_email,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on reset-password')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on reset-password')
		}
		throw new Error(
			error.message || 'Error on reset-password: Undefined error.',
		)
	}
}

/** 비밀번호 재설정 Step2: 코드 검증/변경 */
export const resetPasswordVerifyRequest = async (
	resetData: IResetPasswordStep2,
) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/password-verify`,
			resetData,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on reset-password')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on reset-password')
		}
		throw new Error(
			error.message || 'Error on reset-password: Undefined error.',
		)
	}
}

/**
 * (미사용) auth provider 쪽에서 사용 예정이었으나 현재는 주석 처리된 상태
 */
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

/** 유저 목록 */
export const getUsers = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/get-users`,
			{ withCredentials: true },
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

/** 유저 타입/권한 업데이트 */
export const updateUserTypes = async (updateData: IUpdateUserType) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/update-user-types`,
			updateData,
			{ withCredentials: true },
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

/** 유저 삭제 */
export const deleteUser = async (user_id: string) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/auth/delete-user`,
			{ user_id },
			{ withCredentials: true },
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

/**
 * =========================================
 * GATEWAY
 * =========================================
 * - 게이트웨이 조회/생성/단건 조회/타입별 조회
 */

/** 게이트웨이 전체 목록 */
export const getGateways = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on getting-gateways: Undefined error',
			)
		}
		return data.gateways
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

/** 활성 게이트웨이 목록 */
export const getActiveGateways = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway/active-gateways`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on getting-gateways: Undefined error',
			)
		}
		return data.gateways
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

/**
 * 게이트웨이 단건 조회
 * - endpoint가 /product 아래에 있음(서버 라우팅 구조상 특이점)
 */
export const getSingleGateway = async (gatewayNumber: string) => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway/single-gateway/${gatewayNumber}`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on getting-gateways: Undefined error',
			)
		}
		return data.gateway
	} catch (error: any) {
		// ❗ 서버 메시지 우선 throw
		throw new Error(
			error.response?.data?.message || 'Serverda xatolik yuz berdi',
		)
	}
}

/** 게이트웨이 생성 */
export const createGatewayRequest = async (gateway: ICreateGateway) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway/create`,
			gateway,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating office-gateway')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(
				error.response.data.message || 'Error on creating office-gateway',
			)
		}
		throw new Error(
			error.message || 'Error on creating office-gateway: Undefined error.',
		)
	}
}

/** 오피스용 게이트웨이 생성 (특수 endpoint: /product/...) */
export const createOfficeGatewayRequest = async (data: any) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway/create-office-gateway`,
			data,
			{ withCredentials: true },
		)
		const result = res.data

		if (result.state === 'fail') {
			throw new Error(result.message || 'Error on office-gateway')
		}

		return result
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on office-gateway')
		}
		throw new Error(
			error.message || 'Error on office-gateway: Undefined error.',
		)
	}
}

/** 제품 상태 변경 */ // Need to be checked and completed
export const updateGatewaytStatus = async (
	updateData: IUpdateProductStatus,
) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway${updateData.product_endpoint}`,
			{
				product_type: updateData.product_type,
				product_id: updateData.product_id,
			},
			{ withCredentials: true },
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

/** 제품 삭제 */
export const deleteGateway = async (deleteData: IUpdateProductStatus) => {
	try {
		const res = await axios.delete(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway${deleteData.product_endpoint}`,
			{
				withCredentials: true,
				params: {
					product_type: deleteData.product_type,
					product_id: deleteData.product_id,
				},
			},
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

/**
 * 게이트웨이 타입별 조회
 * - response: { gateways: { GATEWAY: [], VERTICAL_NODE_GATEWAY: [] } }
 */
type GatewayByTypeResponse = {
	GATEWAY: IGateway[]
	VERTICAL_NODE_GATEWAY: IGateway[]
}

export const getGatewaysByTypeRequest =
	async (): Promise<GatewayByTypeResponse> => {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway/gateways-bytype`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on getting gateways by type')
		}

		return {
			GATEWAY: data.gateways?.GATEWAY ?? [],
			VERTICAL_NODE_GATEWAY: data.gateways?.VERTICAL_NODE_GATEWAY ?? [],
		}
	}

/** Vertical Node Gateway만 별도로 필요할 때 쓰는 편의 함수 */
export const getVerticalNodeGatewaysByTypeRequest = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/gateway/gateways-bytype`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on getting gateways by type')
		}

		return data.gateways?.VERTICAL_NODE_GATEWAY ?? []
	} catch (error: any) {
		throw new Error(
			error.response?.data?.message ||
				error.message ||
				'Error on getting vertical node gateways by type: Undefined error.',
		)
	}
}

/**
 * =========================================
 * HATCH NODE (일반 노드)
 * =========================================
 * - 노드 조회/생성
 * - 노드들을 게이트웨이에 연결(combine)
 */

/** 노드 전체 목록 */
export const getNodes = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/node`,
			{ withCredentials: true },
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

/**
 * ⚠️ 중복 함수 주의
 * - 아래 getNodesRequest는 getNodes와 동일 endpoint를 호출
 * - 기존 코드 호환용으로 남겨두되, 가능하면 getNodes로 통일 권장
 */
export const getNodesRequest = async () => {
	const res = await axios.get(`${import.meta.env.VITE_SERVER_BASE_URL}/node`, {
		withCredentials: true,
	})
	const data = res.data
	if (data.state === 'fail') throw new Error(data.message || '...')
	return data.nodes
}

/** 활성 노드(전체 타입 active endpoint) */
export const getActiveNodes = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/node/alltype-active-nodes`,
			{ withCredentials: true },
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

/** 노드 생성 */
export const createNodeRequest = async (nodes: ICreateNode[]) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/node/create-nodes`,
			nodes,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

/** 노드들을 게이트웨이에 연결 */
export const combineHatchNodesToGatewayRequest = async (payload: {
	gateway_id: string
	nodes: string[]
}) => {
	const res = await axios.post(
		`${import.meta.env.VITE_SERVER_BASE_URL}/node/combine/to-gateway`,
		payload,
		{ withCredentials: true },
	)

	const data = res.data
	if (data.state === 'fail')
		throw new Error(data.message || 'HATCH combine failed')
	return data
}

/**
 * =========================================
 * ANGLE NODE
 * =========================================
 * - Angle node 생성/활성 조회/빌딩별 조회/요약/게이트웨이 결합
 */

/** Angle 노드 생성 */
export const createAngleNodeRequest = async (nodes: AngleNodeCreate[]) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/angle-node/create`,
			nodes,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

/** 활성 Angle 노드 목록 */
export const getActiveAngleNodes = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/angle-node/active`,
			{ withCredentials: true },
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
// ---------------------------------------------------------------------------------- //
/** 빌딩별 Angle 노드 목록 */
export const fetchBuildingAngleNodes = async (buildingId: string) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/building/${buildingId}/angle-nodes`,
			{ withCredentials: true },
		)

		const data = response.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		return new Error(
			error.response?.data?.message ||
				'Error on fetching building angle-nodes.',
		)
	}
}
// ---------------------------------------------------------------------------------- //

/**
 * Angle 노드 alive 목록
 * - 서버가 배열을 바로 내려주는 형태라고 주석에 적혀있음
 */
export const getAngleAliveNodes = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/angle-node/alive`,
			{ withCredentials: true },
		)

		const data = res.data
		if (!Array.isArray(data)) {
			throw new Error('Invalid response format from /angle-nodes/alive')
		}

		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

/** Angle 노드들을 gateway에 연결 (fetch 사용) */
export const combineAngleNodesToGatewayRequest = async (payload: {
	angle_nodes: string[]
	gateway_id: string
}) => {
	const baseUrl = import.meta.env.VITE_SERVER_BASE_URL

	const res = await fetch(`${baseUrl}/angle-node/combine/to-gateway`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include', // ✅ withCredentials 역할
		body: JSON.stringify(payload),
	})

	const data = await res.json()
	if (!res.ok) throw new Error(data?.message ?? 'angle-node combine failed')
	return data
}

/**
 * =========================================
 * VERTICAL NODE
 * =========================================
 * - Vertical node 생성/조회/게이트웨이 결합
 */

/** Vertical 노드 생성 */
export const createVerticalNodeRequest = async (
	nodes: VerticalNodeCreate[],
) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/vertical-node/create`,
			nodes,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating vertical nodes')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(
				error.response.data.message || 'Error on creating vertical nodes',
			)
		}

		throw new Error(
			error.message || 'Error on creating vertical nodes: Undefined error.',
		)
	}
}

/** Vertical 노드 목록 조회 */
export const getVerticalNodesRequest = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/vertical-node`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data?.state === 'fail') {
			throw new Error(data.message || 'Error on getting vertical nodes')
		}

		// ✅ 핵심: 배열만 반환
		return data.data ?? []
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(
				error.response.data.message || 'Error on getting vertical nodes',
			)
		}
		throw new Error(
			error.message || 'Error on getting vertical nodes: Undefined error.',
		)
	}
}

/** Vertical 노드들을 gateway에 연결 (fetch 사용) */
export const combineVerticalNodesToGatewayRequest = async (payload: {
	gateway_id: string
	vertical_nodes: string[]
}) => {
	const res = await fetch(
		`${import.meta.env.VITE_SERVER_BASE_URL}/vertical-node/combine/to-gateway`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include', // withCredentials
			body: JSON.stringify(payload),
		},
	)

	const data = await res.json()
	if (!res.ok) {
		throw new Error(data?.message ?? 'vertical-node combine failed')
	}
	return data
}

/**
 * =========================================
 * ALL-TYPE ACTIVE (통합)
 * =========================================
 * - endpoint: /node/get-alltype-active-nodes
 * - 서버 응답: { state: "success", nodes: { nodes: [], angle_nodes: [], vertical_nodes: [] } }
 */

/** 전체 타입 active 노드 조회 */
export const getAllTypeActiveNodesRequest = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/node/alltype-active-nodes`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on getting active nodes')
		}

		return data.nodes
	} catch (error: any) {
		throw new Error(
			error.response?.data?.message ||
				error.message ||
				'Error on getting active nodes: Undefined error.',
		)
	}
}

/**
 * =========================================
 * PRODUCT COMMON
 * =========================================
 * - 제품 상태 변경/삭제
 * - 노드 위치 세팅(FormData)
 */

/** 제품 상태 변경 */ // Need to be checked and completed
export const updateNodetStatus = async (updateData: IUpdateProductStatus) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/node${updateData.product_endpoint}`,
			{
				product_type: updateData.product_type,
				product_id: updateData.product_id,
			},
			{ withCredentials: true },
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

/** 제품 삭제 */
export const deleteNode = async (deleteData: IUpdateProductStatus) => {
	try {
		const res = await axios.delete(
			`${import.meta.env.VITE_SERVER_BASE_URL}/node${deleteData.product_endpoint}`,
			{
				withCredentials: true,
				params: {
					product_type: deleteData.product_type,
					product_id: deleteData.product_id,
				},
			},
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

/** 노드 위치 세팅 (FormData) */
export const NodePositionRequest = async (FormData: FormData) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/product/set-node-position`,
			FormData,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on node-positioning: Undefined error',
			)
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

/**
 * =========================================
 * COMPANY / CLIENT / BUILDING
 * =========================================
 * - client/building 생성/삭제/조회
 * - boss 전용 client/building 조회
 * - building 설정(알람레벨) / gateway-building 변경
 */

/** 빌딩 생성 */
export const createBuildingRequest = async (buildingData: ICreateBuilding) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/building/create`,
			buildingData,
			{ withCredentials: true },
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

/** 클라이언트 생성 */
export const createClientRequest = async (clientData: ICreateClient) => {
	try {
		const res = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/create`,
			clientData,
			{ withCredentials: true },
		)
		const data = res.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		if (error.response && error.response.data) {
			throw new Error(error.response.data.message || 'Error on creating node')
		}
		throw new Error(error.message || 'Error on creating node: Undefined error.')
	}
}

/** gateway의 building 변경 */
export const changeGatewayBuildingRequest = async (params: {
	gateway_id: string
	building_id: string
}) => {
	try {
		const res = await axios.post(
			'/building/change-gateway-building',
			{
				gateway_id: params.gateway_id,
				building_id: params.building_id,
			},
			{
				baseURL:
					import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005',
				withCredentials: true,
			},
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
				'Error on changing gateway building: Undefined error.',
		)
	}
}

/** 활성 빌딩 목록 */
export const getActiveBuildings = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/building/active-buildings`,
			{ withCredentials: true },
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

/** 빌딩 전체 목록 */
export const getBuildings = async () => {
	try {
		const res = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/get-buildings`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on getting-buildings: Undefined error',
			)
		}
		return data.buildings
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

/** 클라이언트 목록 */
export const fetchClients = async (): Promise<IClient[]> => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company`,
			{ withCredentials: true },
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data.clients
	} catch (error: any) {
		throw new Error(
			error.response?.data?.message ||
				'Server bilan bog‘lanishda xatolik yuz berdi',
		)
	}
}

/** 클라이언트 삭제 */
export const deleteClient = async (clintId: string) => {
	try {
		const res = await axios.delete(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/delete/${clintId}`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on deleting-Client: Undefined error',
			)
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

/** 특정 client 상세(+빌딩 목록) */
export const fetchClientBuildings = async (clientId: string | undefined) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/${clientId}`,
			{ withCredentials: true },
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		return new Error(
			error.response?.data?.message || 'Error on fetching client data.',
		)
	}
}

/** 빌딩 삭제 */
export const deleteBuilding = async (buildngId: string) => {
	try {
		const res = await axios.delete(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/delete/building/${buildngId}`,
			{ withCredentials: true },
		)

		const data = res.data
		if (data.state === 'fail') {
			throw new Error(
				data.message || 'Error on deleting-bulding: Undefined error',
			)
		}
		return data
	} catch (error: any) {
		throw new Error(error.message || 'Error on connecting to server.')
	}
}

/** building 상세(+노드/angle 노드 등 포함 가능) */
export const fetchBuildingNodes = async (buildingId: string) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/building/${buildingId}`,
			{ withCredentials: true },
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		return new Error(
			error.response?.data?.message || 'Error on fetching building nodes.',
		)
	}
}

/** boss 계정의 clients 조회 */
export const fetchBossClients = async (userId: string): Promise<IClient[]> => {
	try {
		const response = await axios.post(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/boss-clients`,
			{ userId },
			{ withCredentials: true },
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data.clients
	} catch (error: any) {
		throw new Error(
			error.response?.data?.message ||
				'Server bilan bog‘lanishda xatolik yuz berdi',
		)
	}
}

/** boss client의 buildings 조회 */
export const fetchClientBossBuildings = async (
	clientId: string | undefined,
) => {
	try {
		const response = await axios.get(
			`${import.meta.env.VITE_SERVER_BASE_URL}/company/client/boss/${clientId}`,
			{ withCredentials: true },
		)
		const data = response.data

		if (data.state === 'fail') {
			throw new Error(data.message || 'Error on creating node')
		}

		return data
	} catch (error: any) {
		return new Error(
			error.response?.data?.message || 'Error on fetching client data.',
		)
	}
}

/** 빌딩 알람 레벨 설정 */
export const setBuildingAlarmLevelRequest = async (
	buildingId: string,
	levels: { B: number; G: number; Y: number; R: number },
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
				baseURL:
					import.meta.env.VITE_SERVER_BASE_URL ?? 'http://localhost:3005',
				withCredentials: true,
			},
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
				'Error on setting alarm level: Undefined error.',
		)
	}
}
