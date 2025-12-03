import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, tap } from 'rxjs';


interface LoginResp {
  token: string;
  user: { id: string; username: string; email: string };
}

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  private apiUrl = 'http://localhost:1880/api/auth'; // Node-RED endpoint (development)

  private authTokenKey = 'auth_token';
  private user$ = new BehaviorSubject<LoginResp['user'] | null>(null);

  constructor(private http: HttpClient) { 
    const token = this.getToken();
    if (token) {
      const payload = this.decodeToken(token);
      if (payload) {
        this.user$.next({ id: payload.sub, username: payload.username, email: payload.email });
      }
    }
  }


  register(username: string, email: string, password: string) {
    return this.http.post(`${this.apiUrl}/register`, { username, email, password });
  }

  login(email: string, password: string) {
    return this.http.post<LoginResp>(`${this.apiUrl}/login`, { email, password })
      .pipe(tap(resp => {
        this.setToken(resp.token);
        this.user$.next(resp.user);
      }));
  }

  logout() {
    this.clearToken();
    this.user$.next(null);
  }


  getToken(): string | null {
    // return localStorage.getItem(this.authTokenKey);
    return sessionStorage.getItem(this.authTokenKey);
  }

  private setToken(token: string) {
    // localStorage.setItem(this.authTokenKey, token);
    sessionStorage.setItem(this.authTokenKey, token);
  }

  private clearToken() {
    // localStorage.removeItem(this.authTokenKey);
    sessionStorage.removeItem(this.authTokenKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getUser$() {
    return this.user$.asObservable();
  }

  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  }

}
