import { CommonModule } from '@angular/common';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { MixedChartComponent } from '../mixed-chart/mixed-chart.component';
import { LoaderComponent } from '../loader/loader.component';
import { ChartConfigComponent } from '../chart-config/chart-config.component';

@NgModule({
  declarations: [
    AppComponent,
    MixedChartComponent,
    LoaderComponent,
    ChartConfigComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule
  ],
  providers: [provideHttpClient(withXhr())],
  bootstrap: [AppComponent]
})
export class AppModule { }
