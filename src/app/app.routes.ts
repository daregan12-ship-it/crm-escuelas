import { Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
	{ path: '', redirectTo: 'login', pathMatch: 'full' },
	{
		path: 'login',
		loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
	},
	{
		path: 'register',
		loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent)
	},
	{
		path: 'dashboard',
		loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
		canActivate: [AuthGuard]
	},
	// catch-all -> login (simple for now)
	{ path: '**', redirectTo: 'login' }
];
