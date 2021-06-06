import { NgModule } from '@angular/core';
import { ProfitChartComponent } from './profit-chart.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    HttpClientModule
  ],
  exports: [
    ProfitChartComponent
  ],
  declarations: [
    ProfitChartComponent
  ],
  providers: []
})
export class ProfitChartModule { }
