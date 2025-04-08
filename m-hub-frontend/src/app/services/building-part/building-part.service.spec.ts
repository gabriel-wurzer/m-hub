import { TestBed } from '@angular/core/testing';

import { BuildingPartService } from './building-part.service';

describe('BuildingPartService', () => {
  let service: BuildingPartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BuildingPartService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
