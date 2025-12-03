import { Injectable } from '@angular/core';

export interface Escuela {
  id: string;
  nombre: string; // nombre de la institución
  cct?: string;
  telefono?: string;
  extension?: string;
  correo?: string;
  representanteNombre?: string;
  representantePuesto?: string;
  direccion?: string;
  logo?: string; // URL o base64
  pagina?: string;
  encargadoRegistro?: string; // nombre/email del usuario que registró
}

export interface Carrera {
  id: string;
  name: string;
  code?: string;
  escuelaId?: string;
  studentsCount?: number;
  // expected population for planning/analysis (number of expected students)
  expectedPopulation?: number;
  logo?: string; // base64 or url
}

export interface UserItem {
  name?: string;
  email: string;
  // passwords are stored in localStorage by AuthService; avoid sending them to disk
  password?: string;
  // role: 'admin' | 'user'
  role?: string;
  // if role === 'user', the escuela (institution) the user belongs to
  escuelaId?: string;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private escKey = 'crm_escuelas_v1';
  private carKey = 'crm_carreras_v1';
  private usersKey = 'crm_users_v1';

  // simple in-memory counter to help generate unique ids
  private idCounter = 0;

  private generateUniqueId(prefix: string): string {
    this.idCounter++;
    return `${prefix}_${Date.now()}_${this.idCounter}_${Math.random().toString(36).substr(2,9)}`;
  }

  private read<T>(key: string): T[] {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  }

  private write<T>(key: string, arr: T[]) {
    try {
      localStorage.setItem(key, JSON.stringify(arr, null, 2));
      // After persisting to localStorage, attempt to send a copy (without logos)
      // to a local save server so we can keep a file copy on disk during development.
      try {
        // don't block main flow if server is not available
        const payload = this.exportAllWithoutLogos();
        // send but don't await
        if (typeof window !== 'undefined' && 'fetch' in window) {
          fetch('http://localhost:3001/save-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(() => { /* ignore errors */ });
        }
      } catch (e) {
        // ignore
      }
      return;
    } catch (err) {
      // Quota exceeded or storage error — try graceful degradation:
      console.warn('localStorage setItem failed, attempting to save reduced payload', err);

      // 1) Try removing potential large fields like `logo` from items
      try {
        const reduced = (arr as any[]).map(item => {
          const copy = { ...(item || {}) } as any;
          if (copy && typeof copy === 'object' && 'logo' in copy) {
            delete copy.logo;
          }
          return copy;
        });
        localStorage.setItem(key, JSON.stringify(reduced, null, 2));
        console.warn('Saved data without logo fields to avoid quota exceed.');
        return;
      } catch (err2) {
        console.warn('Saving without logos also failed', err2);
      }

      // 2) Try trimming the array to keep only most recent items (last 200)
      try {
        const trimmed = (arr as any[]).slice(-200).map(item => {
          const copy = { ...(item || {}) } as any;
          if (copy && typeof copy === 'object' && 'logo' in copy) delete copy.logo;
          return copy;
        });
        localStorage.setItem(key, JSON.stringify(trimmed, null, 2));
        console.warn('Saved trimmed data (last 200 items) to avoid quota exceed.');
        return;
      } catch (err3) {
        console.error('Unable to write to localStorage: quota exceeded and fallback attempts failed.', err3);
        // As a last resort, try to remove the key to free space (do not throw)
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
      }
    }
  }

  getEscuelas(): Escuela[] {
    const arr = this.read<Escuela>(this.escKey) || [];
    let changed = false;
    const normalized = arr.map((it, idx) => {
      if (!it || !(it as any).id || (it as any).id === '' || (it as any).id === 'undefined') {
        changed = true;
        return { ...(it || {}), id: this.generateUniqueId('esc') } as Escuela;
      }
      return it;
    });
    if (changed) {
      // persist normalized IDs so subsequent reads are stable
      this.write(this.escKey, normalized as any);
    }
    return normalized as Escuela[];
  }

  // users handling (kept lightweight — AuthService still manages auth flows)
  getUsers(): UserItem[] {
    return this.read<UserItem>(this.usersKey) || [];
  }

  addUser(u: UserItem) {
    const arr = this.getUsers();
    arr.push(u);
    this.write(this.usersKey, arr as any);
    return true;
  }

  updateUser(email: string, patch: Partial<UserItem>) {
    const arr = this.getUsers();
    const idx = arr.findIndex(x => x.email === email);
    if (idx === -1) return false;
    arr[idx] = { ...arr[idx], ...patch };
    this.write(this.usersKey, arr as any);
    return true;
  }

  deleteUser(email: string) {
    const arr = this.getUsers();
    const filtered = arr.filter(x => x.email !== email);
    this.write(this.usersKey, filtered as any);
    return true;
  }

  addEscuela(e: Omit<Escuela, 'id'>) {
    const arr = this.getEscuelas();
  const id = this.generateUniqueId('esc');
    arr.push({ id, ...e });
    this.write(this.escKey, arr);
    return id;
  }

  updateEscuela(id: string, patch: Partial<Omit<Escuela, 'id'>>) {
    const arr = this.getEscuelas();
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return false;
    arr[idx] = { ...arr[idx], ...patch } as Escuela;
    this.write(this.escKey, arr);
    return true;
  }

  deleteEscuela(id: string) {
    const arr = this.getEscuelas();
    const filtered = arr.filter(x => x.id !== id);
    this.write(this.escKey, filtered);
    return true;
  }

  getCarreras(): Carrera[] {
    const arr = this.read<Carrera>(this.carKey) || [];
    let changed = false;
    const normalized = arr.map((it, idx) => {
      if (!it || !(it as any).id || (it as any).id === '' || (it as any).id === 'undefined') {
        changed = true;
        return { ...(it || {}), id: this.generateUniqueId('car') } as Carrera;
      }
      return it;
    });
    if (changed) {
      this.write(this.carKey, normalized as any);
    }
    return normalized as Carrera[];
  }

  addCarrera(c: Omit<Carrera, 'id'>) {
    const arr = this.getCarreras();
  const id = this.generateUniqueId('car');
    arr.push({ id, ...c });
    this.write(this.carKey, arr);
    return id;
  }

  updateCarrera(id: string, patch: Partial<Omit<Carrera, 'id'>>) {
    const arr = this.getCarreras();
    const idx = arr.findIndex(x => x.id === id);
    if (idx === -1) return false;
    arr[idx] = { ...arr[idx], ...patch } as Carrera;
    this.write(this.carKey, arr);
    return true;
  }

  deleteCarrera(id: string) {
    const arr = this.getCarreras();
    const filtered = arr.filter(x => x.id !== id);
    this.write(this.carKey, filtered);
    return true;
  }

  exportAll() {
    return {
      escuelas: this.getEscuelas(),
      carreras: this.getCarreras(),
      users: this.getUsers()
    };
  }

  /**
   * Return exportable data but removing any large fields like `logo`.
   */
  exportAllWithoutLogos() {
    const esc = this.getEscuelas().map(e => {
      const copy: any = { ...(e || {}) };
      if ('logo' in copy) delete copy.logo;
      return copy;
    });
    const car = this.getCarreras().map(c => {
      const copy: any = { ...(c || {}) };
      if ('logo' in copy) delete copy.logo;
      return copy;
    });
    // include users (without passwords) in the export for disk save
    const users = this.getUsers().map(u => ({ name: u.name, email: u.email, role: u.role, escuelaId: u.escuelaId }));
    return { escuelas: esc, carreras: car, users };
  }

  /**
   * Overwrite storage with provided data. Optionally strip logos.
   * Ensures all items have valid ids before writing.
   */
  setAll(payload: { escuelas?: Partial<Escuela>[]; carreras?: Partial<Carrera>[]; users?: Partial<UserItem>[] }, options?: { stripLogos?: boolean }) {
    const escs: Escuela[] = (payload.escuelas || []).map((it, idx) => {
      const copy: any = { ...(it || {}) };
      if (!copy.id || copy.id === '' || copy.id === 'undefined') copy.id = this.generateUniqueId('esc');
      if (options?.stripLogos && 'logo' in copy) delete copy.logo;
      return copy as Escuela;
    });

    const cars: Carrera[] = (payload.carreras || []).map((it, idx) => {
      const copy: any = { ...(it || {}) };
      if (!copy.id || copy.id === '' || copy.id === 'undefined') copy.id = this.generateUniqueId('car');
      if (options?.stripLogos && 'logo' in copy) delete copy.logo;
      return copy as Carrera;
    });

    // Persist
    this.write(this.escKey, escs as any);
    this.write(this.carKey, cars as any);
    if (payload.users) {
      // persist users as provided (do not strip passwords here)
      const us: UserItem[] = (payload.users || []).map(u => ({ ...(u as any) }));
      this.write(this.usersKey, us as any);
    }
    return { escuelas: escs, carreras: cars };
  }
}
