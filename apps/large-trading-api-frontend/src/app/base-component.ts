export class BaseComponent {
  public buySignal = 'BUY';
  public closeBuySignal = 'CLOSEBUY';
  public sellSignal = 'SELL';
  public closeSellSignal = 'CLOSESELL';
  public closeSignal = 'CLOSE';

  constructor() { }

  public dateToSimpleString(date: Date): string {
    return ('0' + date.getDate()).slice(-2) + '.' +
      ('0' + (date.getMonth() + 1)).slice(-2) + '.' +
      date.getFullYear() + ' - ' +
      ('0' + date.getHours()).slice(-2) + ':00';
  }
}