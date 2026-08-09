import { Component, ElementRef, input, OnChanges, OnInit, output, SimpleChanges, ViewChild } from '@angular/core';
import { ChartConfig, Exchange, ExchangeSymbol, Strategy, Timeframe } from '@shared';
import { copyChartConfig, normalizeChartConfig } from './chart-config';

@Component({
  selector: 'chart-config',
  templateUrl: './chart-config.component.html',
  styleUrls: ['./chart-config.component.scss'],
  standalone: false
})
export class ChartConfigComponent implements OnChanges, OnInit {
  public readonly initialConfig = input.required<ChartConfig>();
  public readonly disabled = input(false);
  public readonly runRequested = output<ChartConfig>();
  public config: ChartConfig;
  @ViewChild('symbolsPopover') private symbolsPopover?: ElementRef<HTMLElement>;
  @ViewChild('runButton') private runButton?: ElementRef<HTMLButtonElement>;
  private runOriginControl?: HTMLInputElement | HTMLSelectElement;

  public readonly timeframes = Object.values(Timeframe);
  public readonly strategies = Object.values(Strategy).sort((a, b) => a.localeCompare(b));
  public readonly exchanges = Object.values(Exchange)
    .filter(exchange => exchange !== Exchange.BTSE)
    .sort((a, b) => a.localeCompare(b));

  public ngOnInit(): void {
    this.config = copyChartConfig(this.initialConfig());
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['disabled']?.previousValue !== true || changes['disabled'].currentValue !== false || !this.runOriginControl) return;

    const control = this.runOriginControl;
    this.runOriginControl = undefined;
    setTimeout(() => {
      control.classList.remove('run-origin');
      control.focus();
    });
  }

  public get comparisonStrategy(): Strategy | null {
    return this.config.comparisonStrategy?.strategy ?? null;
  }

  public get canRun(): boolean {
    return this.config.autoSymbols || (this.config.symbols.length > 0 && this.config.symbols.every(item => item.symbol.trim().length > 0));
  }

  public setComparisonStrategy(strategy: Strategy | null): void {
    const current = this.config.comparisonStrategy;
    this.config.comparisonStrategy = strategy
      ? { strategy, autoParams: current?.autoParams ?? false }
      : null;
  }

  public addSymbol(): void {
    this.config.symbols.push({ exchange: Exchange.Binance, symbol: '' });
  }

  public deleteSymbol(index: number): void {
    if (this.config.symbols.length === 1) return;
    this.config.symbols.splice(index, 1);
  }

  public deleteSymbolOnClick(index: number): void {
    this.deleteSymbol(index);
    setTimeout(() => this.symbolsPopover?.nativeElement.focus());
  }

  public normalizeSymbol(symbol: ExchangeSymbol): void {
    symbol.symbol = symbol.symbol.trim().toUpperCase();
  }

  public setTimes(value: number): void {
    this.config.times = Math.max(1, Math.trunc(Number(value) || 1));
  }

  public runOnEnter(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    event.preventDefault();
    this.runOriginControl = target;
    target.classList.add('run-origin');
    this.run();
  }

  public closeSymbolsOnEnter(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeSymbols();
  }

  public deleteSymbolOnEnter(index: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.deleteSymbol(index);
    this.closeSymbols();
  }

  private closeSymbols(): void {
    this.config.symbols.forEach(symbol => {
      symbol.symbol = symbol.symbol.trim().toUpperCase();
    });
    this.symbolsPopover?.nativeElement.hidePopover();
    setTimeout(() => this.runButton?.nativeElement.focus());
  }

  public run(): void {
    if (!this.canRun) return;
    const config = normalizeChartConfig(this.config);
    this.config = copyChartConfig(config);
    this.runRequested.emit(config);
  }
}