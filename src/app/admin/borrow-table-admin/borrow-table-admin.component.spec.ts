import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BorrowTableAdminComponent } from './borrow-table-admin.component';

describe('BorrowTableAdminComponent', () => {
  let component: BorrowTableAdminComponent;
  let fixture: ComponentFixture<BorrowTableAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BorrowTableAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BorrowTableAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
