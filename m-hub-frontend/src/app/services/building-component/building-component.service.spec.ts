import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BuildingComponentService } from './building-component.service';

@Injectable()
class TestBuildingComponentService extends BuildingComponentService<any> {
  protected override apiUrl = '/api/test-components';
}

describe('BuildingComponentService', () => {
  let service: TestBuildingComponentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TestBuildingComponentService]
    });
    service = TestBed.inject(TestBuildingComponentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
