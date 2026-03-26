import axios from 'axios';
import { clearStoredAuthSession, getAccessToken } from '../auth/session';

const BASE_URL = import.meta.env.DEV
  ? ''
  : 'https://analysis.deployguard.org';

export const apiClient = async <T>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const { body, headers, method } = options;

  const normalizedHeaders =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : Array.isArray(headers)
        ? Object.fromEntries(headers)
        : headers;
  const accessToken = getAccessToken();
  const requestHeaders = {
    ...(normalizedHeaders ?? {}),
  };

  if (accessToken && !requestHeaders.Authorization) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const response = await axios({
      url,
      baseURL: BASE_URL,
      method,
      headers: requestHeaders,
      data: body,
    });

    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearStoredAuthSession();
    }

    throw error;
  }
};
