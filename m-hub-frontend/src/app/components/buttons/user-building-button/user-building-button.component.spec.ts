import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserBuildingButtonComponent } from './user-building-button.component';

describe('UserBuildingButtonComponent', () => {
  let component: UserBuildingButtonComponent;
  let fixture: ComponentFixture<UserBuildingButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserBuildingButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserBuildingButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
