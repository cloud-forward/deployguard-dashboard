import axios from "axios"
import type { AxiosRequestConfig } from "axios"

const AXIOS_INSTANCE = axios.create({
    baseURL: "https://analysis.deployguard.org",
    headers: {
        "Content-Type": "application/json",
    },
})

export const apiClient = async <T>(
    config: AxiosRequestConfig,
    options?: AxiosRequestConfig
): Promise<T> => {
    const response = await AXIOS_INSTANCE({
        ...config,
        ...options,
    })

    return response.data
}