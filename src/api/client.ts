import axios from "axios"
import type { AxiosRequestConfig } from "axios"

const AXIOS_INSTANCE = axios.create({
    baseURL: "https://analysis.deployguard.org",
    headers: {
        "Content-Type": "application/json",
    },
})

export const apiClient = async <T>(
    url: string,
    options?: AxiosRequestConfig
): Promise<T> => {
    const response = await AXIOS_INSTANCE({
        url,
        ...options,
    })

    return response.data
}