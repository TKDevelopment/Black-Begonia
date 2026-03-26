import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-proposal-access-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './proposal-access-layout.component.html',
})
export class ProposalAccessLayoutComponent {}
