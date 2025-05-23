import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddEquipmentComponent } from './add-equipment.component';

describe('AddEquipmentComponent', () => {
  let component: AddEquipmentComponent;
  let fixture: ComponentFixture<AddEquipmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddEquipmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddEquipmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
