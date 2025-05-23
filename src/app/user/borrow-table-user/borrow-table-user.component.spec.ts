import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BorrowTableUserComponent } from './borrow-table-user.component';

describe('BorrowTableUserComponent', () => {
  let component: BorrowTableUserComponent;
  let fixture: ComponentFixture<BorrowTableUserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BorrowTableUserComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BorrowTableUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
