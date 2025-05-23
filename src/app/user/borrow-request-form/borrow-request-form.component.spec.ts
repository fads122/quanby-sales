import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BorrowRequestFormComponent } from './borrow-request-form.component';

describe('BorrowRequestFormComponent', () => {
  let component: BorrowRequestFormComponent;
  let fixture: ComponentFixture<BorrowRequestFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BorrowRequestFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BorrowRequestFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
