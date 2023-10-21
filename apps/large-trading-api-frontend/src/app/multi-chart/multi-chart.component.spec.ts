import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultiChartComponent } from './multi-chart.component';

describe('MultiChartComponent', () => {
  let component: MultiChartComponent;
  let fixture: ComponentFixture<MultiChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MultiChartComponent]
    });
    fixture = TestBed.createComponent(MultiChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
