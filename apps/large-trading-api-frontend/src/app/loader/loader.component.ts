import { ChangeDetectorRef, Component, Inject } from '@angular/core';

@Component({
    selector: 'loader',
    templateUrl: './loader.component.html',
    styleUrls: ['./loader.component.scss'],
    standalone: false
})
export class LoaderComponent {
  public show = true;

  constructor(@Inject(ChangeDetectorRef) private cd: ChangeDetectorRef) {
    setInterval(() => {
      this.show = false;
      this.cd.detectChanges();
      this.show = true;
    }, 4000);
  }
}
