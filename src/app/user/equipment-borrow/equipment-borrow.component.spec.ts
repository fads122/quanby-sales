import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EquipmentBorrowComponent } from './equipment-borrow.component';

describe('EquipmentBorrowComponent', () => {
  let component: EquipmentBorrowComponent;
  let fixture: ComponentFixture<EquipmentBorrowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EquipmentBorrowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EquipmentBorrowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
