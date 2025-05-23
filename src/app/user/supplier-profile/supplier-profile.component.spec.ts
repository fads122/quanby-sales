import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplierProfileComponent } from './supplier-profile.component';

describe('SupplierProfileComponent', () => {
  let component: SupplierProfileComponent;
  let fixture: ComponentFixture<SupplierProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplierProfileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplierProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
