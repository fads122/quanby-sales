import { Component } from '@angular/core';
import { ToastService } from '../../../services/toast.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  imports: [CommonModule],
  styleUrls: ['./toast.component.css'],
  standalone: true,
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}
}
