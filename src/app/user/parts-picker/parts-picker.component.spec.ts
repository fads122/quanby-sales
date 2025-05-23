import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartsPickerComponent } from './parts-picker.component';

describe('PartsPickerComponent', () => {
  let component: PartsPickerComponent;
  let fixture: ComponentFixture<PartsPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartsPickerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PartsPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
