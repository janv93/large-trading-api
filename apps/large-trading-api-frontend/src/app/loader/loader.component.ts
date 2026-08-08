import { Component, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.scss'],
  standalone: false
})
export class LoaderComponent implements OnDestroy {
  public readonly show = signal(true);

  private intervalId: ReturnType<typeof setInterval>;
  private restartId?: ReturnType<typeof setTimeout>;

  constructor() {
    this.intervalId = setInterval(() => {
      this.show.set(false);
      this.restartId = setTimeout(() => this.show.set(true));
    }, 4000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
    if (this.restartId) clearTimeout(this.restartId);
  }
}
