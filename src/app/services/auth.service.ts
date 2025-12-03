import { Injectable } from '@angular/core';
import { DataService, UserItem } from './data.service';

export interface User {
  name?: string;
  email: string;
  password?: string;
  role?: string; // 'admin' | 'user'
  escuelaId?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentKey = 'crm_current_v1';

  constructor(private data: DataService) {}

  /**
   * Register a user. If role === 'admin' then `adminAuthorizerEmail` and `adminAuthorizerPassword`
   * must be provided and correspond to an existing admin user to approve registration.
   * Returns { ok, message }
   */
  register(payload: { name?: string; email: string; password: string; role?: string; escuelaId?: string; adminAuthorizerEmail?: string; adminAuthorizerPassword?: string; }): { ok: boolean; message?: string } {
    const exists = this.data.getUsers().some(u => u.email === payload.email);
    if (exists) return { ok: false, message: 'Ya existe una cuenta con ese correo.' };

    const role = payload.role || 'user';
    if (role === 'admin') {
      // verify authorizer
      if (!payload.adminAuthorizerEmail || !payload.adminAuthorizerPassword) {
        return { ok: false, message: 'Se requiere credenciales de un administrador existente para crear otro administrador.' };
      }
      const authorizer = this.data.getUsers().find(u => u.email === payload.adminAuthorizerEmail && u.password === payload.adminAuthorizerPassword && u.role === 'admin');
      if (!authorizer) return { ok: false, message: 'Credenciales de administrador inválidas.' };
    } else {
      // normal user must belong to an escuela
      if (!payload.escuelaId) return { ok: false, message: 'Debes seleccionar la institución a la que perteneces.' };
    }

    // persist user (password saved in localStorage users collection by design for this project)
    this.data.addUser({ name: payload.name, email: payload.email, password: payload.password, role, escuelaId: payload.escuelaId });
    return { ok: true };
  }

  login(email: string | undefined, password: string | undefined, role?: string): boolean {
    if (!email || !password) return false;
    const users: User[] = JSON.parse(localStorage.getItem('crm_users_v1') || '[]');
    const found = users.find(u => u.email === email && u.password === password && (!role || u.role === role));
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
