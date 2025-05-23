import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryReceiptComponent } from './delivery-receipt.component';

describe('DeliveryReceiptComponent', () => {
  let component: DeliveryReceiptComponent;
  let fixture: ComponentFixture<DeliveryReceiptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryReceiptComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryReceiptComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
