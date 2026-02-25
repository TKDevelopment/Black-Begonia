import { Component, ViewChild } from '@angular/core';
import { HeaderComponent } from '../../components/shared/header/header.component';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../../components/shared/footer/footer.component';

@Component({
  selector: 'app-public-layout',
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent {
  @ViewChild(HeaderComponent) header!: HeaderComponent;
}
