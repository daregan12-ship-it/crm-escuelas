import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('recaptchaContainer', { static: false }) recaptchaContainer!: ElementRef;
  
  error = '';
  form!: FormGroup;
  private siteKey = '6LfCAO8rAAAAAOdaxsX65B0axrJHKcYgB4OGJQAj';
  recaptchaResponse: string | null = null;
  private widgetId: number | null = null;
  private pollInterval: any = null;
  private pollAttempts = 0;
  private maxPollAttempts = 50; // 10 segundos máximo

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngAfterViewInit(): void {
    // Usar setTimeout para asegurar que el DOM esté completamente renderizado
    setTimeout(() => {
      this.loadRecaptcha();
    }, 0);
  }

  ngOnDestroy(): void {
    // Limpiar el intervalo si existe
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    // Resetear widget
    const win = window as any;
    if (win.grecaptcha && this.widgetId != null) {
      try { 
        win.grecaptcha.reset(this.widgetId); 
      } catch (e) {
        console.error('Error resetting recaptcha:', e);
      }
    }
  }

  private loadRecaptcha(): void {
    const win = window as any;
    
    // Verificar si grecaptcha ya está disponible
    if (win.grecaptcha && win.grecaptcha.render) {
      this.renderRecaptcha();
      return;
    }

    // Verificar si el script ya existe
    const existing = document.querySelector('script[src*="recaptcha/api.js"]');
    
    if (existing) {
      // Script existe, esperar a que grecaptcha esté disponible
      this.waitForRecaptcha();
    } else {
      // Cargar el script
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.waitForRecaptcha();
      };
      script.onerror = () => {
        console.error('Error loading reCAPTCHA script');
        this.error = 'Error al cargar el captcha. Por favor recarga la página.';
      };
      document.head.appendChild(script);
    }
  }

  private waitForRecaptcha(): void {
    const win = window as any;
    
    // Limpiar intervalo previo si existe
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    this.pollAttempts = 0;
    
    this.pollInterval = setInterval(() => {
      this.pollAttempts++;
      
      if (win.grecaptcha && win.grecaptcha.render) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
        this.renderRecaptcha();
      } else if (this.pollAttempts >= this.maxPollAttempts) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
        console.error('reCAPTCHA failed to load after maximum attempts');
        this.error = 'El captcha no se pudo cargar. Por favor recarga la página.';
      }
    }, 200);
  }

  private renderRecaptcha(): void {
    const win = window as any;
    
    try {
      if (!win.grecaptcha || !win.grecaptcha.render) {
        console.error('grecaptcha not available');
        return;
      }

      // Verificar que el contenedor existe en el DOM
      const container = document.getElementById('recaptcha-container');
      if (!container) {
        console.error('reCAPTCHA container not found');
        return;
      }

      // Limpiar contenido previo
      container.innerHTML = '';

      // Renderizar el widget
      this.widgetId = win.grecaptcha.render(container, {
        sitekey: this.siteKey,
        callback: (token: string) => this.onRecaptchaSuccess(token),
        'expired-callback': () => this.onRecaptchaExpired(),
        'error-callback': () => this.onRecaptchaError()
      });
      
      console.log('reCAPTCHA rendered successfully');
    } catch (e) {
      console.error('Error rendering reCAPTCHA:', e);
      this.error = 'Error al renderizar el captcha.';
    }
  }

  private onRecaptchaSuccess(token: string): void {
    this.recaptchaResponse = token;
    this.error = ''; // Limpiar cualquier error previo
  }

  private onRecaptchaExpired(): void {
    this.recaptchaResponse = null;
    this.error = 'El captcha ha expirado. Por favor resuélvelo nuevamente.';
  }

  private onRecaptchaError(): void {
    this.recaptchaResponse = null;
    this.error = 'Error en el captcha. Por favor intenta nuevamente.';
  }

  onSubmit(): void {
    this.error = '';
    
    if (this.form.invalid) {
      this.error = 'Por favor completa todos los campos correctamente.';
      return;
    }
    
    if (!this.recaptchaResponse) {
      this.error = 'Por favor completa el captcha antes de iniciar sesión.';
      return;
    }
    
    const { email, password } = this.form.value;
    const ok = this.auth.login(email ?? '', password ?? '');
    
    if (ok) {
      this.router.navigate(['/dashboard']);
    } else {
      this.error = 'Credenciales inválidas. Verifica correo y contraseña.';
      this.resetRecaptcha();
    }
  }

  private resetRecaptcha(): void {
    const win = window as any;
    if (win.grecaptcha && this.widgetId != null) {
      try {
        win.grecaptcha.reset(this.widgetId);
        this.recaptchaResponse = null;
      } catch (e) {
        console.error('Error resetting recaptcha:', e);
      }
    }
  }
}