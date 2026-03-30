import { Directive, Input, TemplateRef } from '@angular/core';

@Directive({
  selector: 'ng-template[appEntityTableCell]',
  standalone: true,
})
export class EntityTableCellDirective {
  @Input('appEntityTableCell') key!: string;

  constructor(public template: TemplateRef<unknown>) {}
}