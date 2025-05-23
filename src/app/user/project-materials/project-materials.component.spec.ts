import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectMaterialsComponent } from './project-materials.component';

describe('ProjectMaterialsComponent', () => {
  let component: ProjectMaterialsComponent;
  let fixture: ComponentFixture<ProjectMaterialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectMaterialsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectMaterialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
