import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import ApexCharts from 'apexcharts/dist/apexcharts.common.js';

@Component({
  selector: 'candlestick-chart',
  templateUrl: './candlestick-chart.component.html',
  styleUrls: ['./candlestick-chart.component.scss']
})
export class CandlestickChartComponent implements AfterViewInit, OnInit {
  @ViewChild('apexChart')
  public apexChart: ElementRef;

  constructor() { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    console.log(this.apexChart);
    this.initChart();
  }

  initChart() {
    var options = {
      chart: {
        type: 'bar'
      },
      series: [
        {
          name: 'sales',
          data: [30, 40, 35, 50, 49, 60, 70, 91, 125]
        }
      ],
      xaxis: {
        categories: [1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999]
      }
    }

    const chart = new ApexCharts(this.apexChart.nativeElement, options);
    chart.render();
  }

}
