import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { UserMarketListingsViewComponent } from './user-market-listings-view.component';

describe('UserMarketListingsViewComponent', () => {
  let component: UserMarketListingsViewComponent;
  let fixture: ComponentFixture<UserMarketListingsViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, UserMarketListingsViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserMarketListingsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
