import axios from 'axios';

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

  const response = await axios({
    url,
    baseURL: BASE_URL,
    method,
    headers: normalizedHeaders,
    data: body,
  });

  return response.data as T;
};
