import { ChangeDetectorRef, Component, Inject, OnDestroy } from '@angular/core';

@Component({
  selector: 'loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss'],
  standalone: false
})
export class LoaderComponent implements OnDestroy {
  public show = true;

  private intervalId: ReturnType<typeof setInterval>;

  constructor(@Inject(ChangeDetectorRef) private cd: ChangeDetectorRef) {
    this.intervalId = setInterval(() => {
      this.show = false;
      this.cd.detectChanges();
      this.show = true;
    }, 4000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }
}
