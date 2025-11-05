import { TestBed } from '@angular/core/testing';

import { BuildingObjectService } from './building-object.service';

describe('BuildingObjectService', () => {
  let service: BuildingObjectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BuildingObjectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
