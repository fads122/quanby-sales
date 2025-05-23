import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OperationalEquipmentDetailsComponent } from './operational-equipment-details.component';

describe('OperationalEquipmentDetailsComponent', () => {
  let component: OperationalEquipmentDetailsComponent;
  let fixture: ComponentFixture<OperationalEquipmentDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationalEquipmentDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OperationalEquipmentDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
