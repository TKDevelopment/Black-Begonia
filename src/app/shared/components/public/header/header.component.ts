import { Component, Input } from '@angular/core';
import { RouterLink } from "@angular/router";
import { NgIf } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from '../../../../core/services/toast.service';
import { AnalyticsActionDirective } from '../../../directives/analytics-action.directive';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, NgIf, AnalyticsActionDirective],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  @Input() navigationRestricted = false;

  menuOpen = false;

  constructor(
    public dialog: MatDialog,
    private toast: ToastService
  ) {}

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
}
