import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts: Array<{
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    duration?: number,
    action?: { text: string, callback: () => void }
  }> = [];

  show(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
    duration: number = 3000,
    action?: { text: string, callback: () => void }
  ) {
    const toast = { message, type, duration, action };
    this.toasts.push(toast);

    if (duration > 0) {
      setTimeout(() => this.remove(this.toasts.indexOf(toast)), duration);
    }
  }

  confirm(message: string, confirmCallback: () => void) {
    this.show(
      message,
      'warning',
      0, // No auto-dismiss
      {
        text: 'Confirm',
        callback: () => {
          confirmCallback();
          this.remove(this.toasts.length - 1); // Remove the confirmation toast
        }
      }
    );
  }

  remove(index: number) {
    this.toasts.splice(index, 1);
  }

  clearAll() {
  this.toasts = [];
}
}
