import { Injectable } from '@angular/core';

export interface User {
  name?: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private usersKey = 'crm_users_v1';
  private currentKey = 'crm_current_v1';

  register(user: User): boolean {
    const users: User[] = JSON.parse(localStorage.getItem(this.usersKey) || '[]');
    const exists = users.some(u => u.email === user.email);
    if (exists) return false;
    users.push(user);
    localStorage.setItem(this.usersKey, JSON.stringify(users));
    return true;
  }

  login(email: string | undefined, password: string | undefined): boolean {
    if (!email || !password) return false;
    const users: User[] = JSON.parse(localStorage.getItem(this.usersKey) || '[]');
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      localStorage.setItem(this.currentKey, JSON.stringify(found));
      return true;
    }
    return false;
  }

  logout() {
    localStorage.removeItem(this.currentKey);
  }

  currentUser(): User | null {
    return JSON.parse(localStorage.getItem(this.currentKey) || 'null');
  }

  isAuthenticated(): boolean {
    return !!this.currentUser();
  }

  currentUserName(): string | null {
    const u = this.currentUser();
    return u ? (u.name || u.email) : null;
  }
}
