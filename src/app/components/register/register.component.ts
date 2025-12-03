import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DataService, Escuela } from '../../services/data.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  form!: FormGroup;
  error = '';
  success = '';
  escuelas: Escuela[] = [];

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, private data: DataService) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', [Validators.required]],
      role: ['user', [Validators.required]],
      // for normal users
      escuelaId: [''],
      // for admin registration: credentials of an existing admin authorizer
      adminAuthorizerEmail: [''],
      adminAuthorizerPassword: ['']
    });

    this.escuelas = this.data.getEscuelas();
  }

  onSubmit() {
    this.error = '';
    this.success = '';
    if (this.form.invalid) return;
    this.error = '';
    const v = this.form.value;
    if (v.password !== v.confirm) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }

    const payload: any = { name: v.name, email: v.email, password: v.password, role: v.role };
    if (v.role === 'user') payload.escuelaId = v.escuelaId;
    if (v.role === 'admin') {
      payload.adminAuthorizerEmail = v.adminAuthorizerEmail;
      payload.adminAuthorizerPassword = v.adminAuthorizerPassword;
    }

    const res = this.auth.register(payload);
    if (!res.ok) {
      this.error = res.message || 'No se pudo crear la cuenta.';
      return;
    }
    this.success = 'Cuenta creada correctamente. Redirigiendo al login...';
    setTimeout(() => this.router.navigate(['/login']), 900);
  }
}
