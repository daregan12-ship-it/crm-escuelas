import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Try to seed users from data/crm-data.json into localStorage on app startup
async function seedUsersFromFile() {
  try {
    const existing = localStorage.getItem('crm_users_v1');
    if (existing && JSON.parse(existing || '[]').length > 0) return;
    const resp = await fetch('/data/crm-data.json');
    if (!resp.ok) return;
    const obj = await resp.json();
    const users = (obj && obj.payload && obj.payload.users) ? obj.payload.users : [];
    if (Array.isArray(users) && users.length > 0) {
      // only keep name, email, password, role, escuelaId
      const normalized = users.map((u: any) => ({ name: u.name, email: u.email, password: u.password, role: u.role, escuelaId: u.escuelaId }));
      localStorage.setItem('crm_users_v1', JSON.stringify(normalized, null, 2));
      console.info('Seeded users from /data/crm-data.json');
    }
  } catch (e) {
    // ignore - not critical
    // console.warn('Could not seed users from file', e);
  }
}

seedUsersFromFile().finally(() => {
  // Ensure default admin exists in localStorage even if fetch failed
  try {
    const ensure = () => {
      try {
        const key = 'crm_users_v1';
        const raw = localStorage.getItem(key) || '[]';
        const arr = JSON.parse(raw) || [];
        const adminEmail = 'admin@crm.local';
        const hasAdmin = arr.some((u: any) => u && u.email === adminEmail && u.role === 'admin');
        if (!hasAdmin) {
          arr.push({ name: 'Administrador por defecto', email: adminEmail, password: 'Admin@1234', role: 'admin' });
          localStorage.setItem(key, JSON.stringify(arr, null, 2));
          console.info('Default admin added to localStorage');
        }
      } catch (e) {
        // ignore
      }
    };
    ensure();
  } catch (e) {
    // ignore
  }

  bootstrapApplication(App, appConfig).catch((err) => console.error(err));
});
