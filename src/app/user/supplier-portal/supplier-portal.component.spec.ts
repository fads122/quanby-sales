import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplierPortalComponent } from './supplier-portal.component';

describe('SupplierPortalComponent', () => {
  let component: SupplierPortalComponent;
  let fixture: ComponentFixture<SupplierPortalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplierPortalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplierPortalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
