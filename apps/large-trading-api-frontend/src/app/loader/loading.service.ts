import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  public readonly loading = signal(true);
  public readonly loadingText = signal('');
  public readonly loadingTextInfo = signal('');
  public readonly isError = signal(false);

  public setLoadingText(loadingText?: string, loadingTextInfo?: string): void {
    this.loading.set(Boolean(loadingText || loadingTextInfo));
    this.isError.set(false);
    this.loadingText.set(loadingText ?? '');
    this.loadingTextInfo.set(loadingTextInfo ?? '');
  }

  public setErrorText(error: any): void {
    this.loading.set(true);
    this.isError.set(true);
    this.loadingText.set('Received error');
    this.loadingTextInfo.set(error.error?.error || (typeof error.error === 'string' ? error.error : null) || error.message || error);
  }
}