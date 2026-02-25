import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ToastService, ToastType } from '../../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss'
})
export class ToastComponent implements OnInit {
  message: string = '';
  type: ToastType = 'success';
  visible = false;
  fadedIn = false;

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.toastService.toast$.subscribe(({ message, type }) => {
      this.message = message;
      this.type = type;
      this.show();
    });
  }

  show() {
    this.visible = true;
    setTimeout(() => (this.fadedIn = true), 50);

    setTimeout(() => {
      this.fadedIn = false;
      setTimeout(() => (this.visible = false), 500);
    }, 4000);
  }

  hide() {
    this.fadedIn = false;
    setTimeout(() => (this.visible = false), 500);
  }
}
