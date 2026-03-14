import axios from 'axios'

const AXIOS_INSTANCE = axios.create({
    baseURL: 'https://analysis.deployguard.org',
    headers: {
        'Content-Type': 'application/json',
    },
})

export const apiClient = <T>(config: any): Promise<T> => {
    return AXIOS_INSTANCE(config).then(({ data }) => data)
}