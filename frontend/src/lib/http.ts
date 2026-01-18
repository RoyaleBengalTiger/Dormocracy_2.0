 const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://sailorlike-monatomic-elina.ngrok-free.dev').replace(/\/$/, '');
 
 class HttpClient {
   private baseUrl: string;
   private accessToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(token: string) => void> = [];
 
   constructor(baseUrl: string) {
     this.baseUrl = baseUrl;
     this.loadTokenFromStorage();
   }
 
   private loadTokenFromStorage() {
     this.accessToken = localStorage.getItem('accessToken');
   }
 
   private buildUrl(endpoint: string): string {
     // Ensure endpoint starts with /
     const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
     return `${this.baseUrl}${normalizedEndpoint}`;
   }
 
   setAccessToken(token: string | null) {
     this.accessToken = token;
     if (token) {
       localStorage.setItem('accessToken', token);
     } else {
       localStorage.removeItem('accessToken');
     }
   }
 
   getAccessToken() {
     return this.accessToken;
   }
 
  private async refreshAccessToken(): Promise<string | null> {
    try {
      const response = await fetch(this.buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data.accessToken) {
        this.setAccessToken(data.accessToken);
        return data.accessToken;
      }
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  private onAccessTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

   private async request<T>(
     endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false
   ): Promise<T> {
     const url = this.buildUrl(endpoint);
     const headers: HeadersInit = {
       'Content-Type': 'application/json',
     'ngrok-skip-browser-warning': 'true',
       ...(options.headers || {}),
     };
 
     if (this.accessToken) {
       headers['Authorization'] = `Bearer ${this.accessToken}`;
     }
 
     const config: RequestInit = {
       ...options,
       headers,
       credentials: 'include', // Include cookies for refresh token
     };
 
     try {
       const response = await fetch(url, config);
 
      // Handle 401 - try to refresh token and retry
       if (response.status === 401) {
        // Don't retry refresh endpoint itself or if this is already a retry
        if (endpoint === '/auth/refresh' || isRetry) {
          this.setAccessToken(null);
          window.location.href = '/login';
          throw new Error('Unauthorized');
        }

        // If already refreshing, queue this request
        if (this.isRefreshing) {
          return new Promise<T>((resolve, reject) => {
            this.addRefreshSubscriber((token: string) => {
              // Retry with new token
              this.request<T>(endpoint, options, true)
                .then(resolve)
                .catch(reject);
            });
          });
        }

        // Try to refresh the token
        this.isRefreshing = true;
        const newToken = await this.refreshAccessToken();
        this.isRefreshing = false;

        if (newToken) {
          // Notify all queued requests
          this.onAccessTokenRefreshed(newToken);
          // Retry the original request
          return this.request<T>(endpoint, options, true);
        } else {
          // Refresh failed, clear token and redirect
          this.setAccessToken(null);
          window.location.href = '/login';
          throw new Error('Session expired');
        }
       }
 
       if (!response.ok) {
         // Try to parse as JSON, fall back to text
         const contentType = response.headers.get('content-type');
         let errorMessage = response.statusText;
         
         if (contentType?.includes('application/json')) {
           try {
             const error = await response.json();
             errorMessage = error.message || errorMessage;
           } catch {
             // JSON parsing failed, use statusText
           }
         } else {
           // Response is not JSON (likely HTML error page)
           const text = await response.text();
           if (text.includes('<html')) {
             errorMessage = `Server error (${response.status}): Expected JSON but received HTML`;
           } else {
             errorMessage = text.substring(0, 200) || errorMessage;
           }
         }
         
         throw new Error(errorMessage);
       }
 
       // Handle 204 No Content
       if (response.status === 204) {
         return null as T;
       }
 
       return await response.json();
     } catch (error) {
     if (error instanceof Error) {
       console.error(`HTTP request failed for ${endpoint}:`, error);
       throw error;
     }
     console.error(`Network request failed for ${endpoint}:`, error);
     throw new Error(`Network request failed for ${endpoint}`);
     }
   }
 
   async get<T>(endpoint: string): Promise<T> {
     return this.request<T>(endpoint, { method: 'GET' });
   }
 
   async post<T>(endpoint: string, data?: unknown): Promise<T> {
     return this.request<T>(endpoint, {
       method: 'POST',
       body: data ? JSON.stringify(data) : undefined,
     });
   }
 
   async patch<T>(endpoint: string, data?: unknown): Promise<T> {
     return this.request<T>(endpoint, {
       method: 'PATCH',
       body: data ? JSON.stringify(data) : undefined,
     });
   }
 
   async delete<T>(endpoint: string): Promise<T> {
     return this.request<T>(endpoint, { method: 'DELETE' });
   }
 }
 
 export const httpClient = new HttpClient(API_BASE_URL);