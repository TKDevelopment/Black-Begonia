import { Component } from '@angular/core';
import { RouterLink } from "@angular/router";
import { NgIf } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, NgIf],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  menuOpen = false;

  constructor(
    public dialog: MatDialog,
    private toast: ToastService
  ) {}

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
}
