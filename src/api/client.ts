import axios, { type AxiosRequestConfig } from 'axios';

const BASE_URL = 'https://analysis.deployguard.org';

export const apiClient = async <T>(
  url: string,
  options: AxiosRequestConfig = {},
): Promise<T> => {
  const response = await axios({
    url,
    baseURL: BASE_URL,
    ...options,
  });

  return response.data as T;
};
