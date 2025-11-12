import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmModalService } from '../../../services/confirm-modal.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-confirm-modal',
  imports: [CommonModule],
  templateUrl: './confirm-modal.component.html',
  styleUrls: ['./confirm-modal.component.css']
})
export class ConfirmModalComponent implements OnInit, OnDestroy {
  @ViewChild('modalCard') modalCard!: ElementRef<HTMLElement>;

  show = false;
  title = 'Confirmar';
  message = '¿Estás seguro?';

  private sub!: Subscription;

  constructor(private svc: ConfirmModalService, private host: ElementRef) {}

  ngOnInit(): void {
    this.sub = this.svc.state$.subscribe(s => {
      this.show = !!s.show;
      if (s.title) this.title = s.title;
      if (s.message) this.message = s.message;
      if (this.show) setTimeout(() => this.trapFocus(), 0);
    });
    // listen global escape
    window.addEventListener('keydown', this.onKeydown);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    window.removeEventListener('keydown', this.onKeydown);
  }

  onConfirm() {
    this.svc.answer(true);
  }

  onCancel() {
    this.svc.answer(false);
  }

  // Close on Escape
  private onKeydown = (e: KeyboardEvent) => {
    if (!this.show) return;
    if (e.key === 'Escape') this.onCancel();
    if (e.key === 'Enter') this.onConfirm();
  };

  // Minimal focus trap: focus first focusable element inside modal
  private trapFocus() {
    try {
      const root = this.modalCard?.nativeElement || (this.host && (this.host.nativeElement as HTMLElement));
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length) focusables[0].focus();
    } catch (e) {
      // ignore
    }
  }
}
