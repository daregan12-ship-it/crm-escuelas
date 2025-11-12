import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmState {
  show: boolean;
  title?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  private stateSubject = new BehaviorSubject<ConfirmState>({ show: false });
  state$ = this.stateSubject.asObservable();

  private resolver: ((v: boolean) => void) | null = null;

  open(message: string, title = 'Confirmar'): Promise<boolean> {
    this.stateSubject.next({ show: true, message, title });
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  answer(value: boolean) {
    // hide and resolve
    this.stateSubject.next({ show: false });
    if (this.resolver) {
      this.resolver(value);
      this.resolver = null;
    }
  }
}
