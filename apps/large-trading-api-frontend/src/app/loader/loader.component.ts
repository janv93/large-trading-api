import { ChangeDetectorRef, Component } from '@angular/core';

@Component({
  selector: 'loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss']
})
export class LoaderComponent {
  public show = true;

  constructor(private cd: ChangeDetectorRef) {
    setInterval(() => {
      this.show = false;
      cd.detectChanges();
      this.show = true;
    }, 4000);
  }
}
