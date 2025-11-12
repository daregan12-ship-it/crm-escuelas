import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', [Validators.required]]
    });
  }

  onSubmit() {
    this.error = '';
    this.success = '';
    if (this.form.invalid) return;
    const { name, email, password, confirm } = this.form.value;
    if (password !== confirm) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }
    const ok = this.auth.register({ name, email, password });
    if (!ok) {
      this.error = 'Ya existe una cuenta con ese correo.';
      return;
    }
    this.success = 'Cuenta creada correctamente. Redirigiendo al login...';
    setTimeout(() => this.router.navigate(['/login']), 900);
  }
}
