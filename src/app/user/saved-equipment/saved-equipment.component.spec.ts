import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavedEquipmentComponent } from './saved-equipment.component';

describe('SavedEquipmentComponent', () => {
  let component: SavedEquipmentComponent;
  let fixture: ComponentFixture<SavedEquipmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedEquipmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SavedEquipmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
