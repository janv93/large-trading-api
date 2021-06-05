import { Component, OnInit, ViewChild } from '@angular/core';

declare const FusionCharts: any;

@Component({
  selector: 'candlestick-chart',
  templateUrl: './candlestick-chart.component.html',
  styleUrls: ['./candlestick-chart.component.scss']
})
export class CandlestickChartComponent implements OnInit {
  @ViewChild('chartContainer')
  public chartContainer: any;

  public type = 'timeseries';
  public width = '100%';
  public height = '400';
  public dataSource: any;

  constructor() { }

  ngOnInit(): void {
    this.initData();

    new FusionCharts({
      type: 'timeseries',
      renderAt: 'chart-container',
      width: '100%',
      height: '400',
      dataSource: this.dataSource
    }).render();
  }

  private initData(): void {
    this.dataSource = {
      chart: {
        theme: 'candy'
      },
      caption: {
        text: 'Apple Inc. Stock Price'
      },
      subcaption: {
        text: 'Stock prices from January 1980 - November 2011'
      },
      yaxis: [
        {
          plot: {
            value: {
              open: 'Open',
              high: 'High',
              low: 'Low',
              close: 'Close'
            },
            type: 'candlestick'
          },
          format: {
            prefix: '$'
          },
          title: 'Stock Value'
        }
      ]
    };

    const data = [
      [
        '06/05/2021, 12:29:00 AM',
        0.513393,
        0.515625,
        0.513393,
        0.513393,
        117258400
      ],
      [
        '06/05/2021, 12:30:00 AM',
        0.488839,
        0.488839,
        0.486607,
        0.486607,
        43971200
      ]
    ];

    const schema = [{
      name: 'Date',
      type: 'date',
      format: '%m/%d/%Y, %I:%M:%S %p'
    }, {
      name: 'Open',
      type: 'number'
    }, {
      name: 'High',
      type: 'number'
    }, {
      name: 'Low',
      type: 'number'
    }, {
      name: 'Close',
      type: 'number'
    }, {
      name: 'Volume',
      type: 'number'
    }]

    const dataStore = new FusionCharts.DataStore();
    this.dataSource.data = dataStore.createDataTable(data, schema);
  }

}
