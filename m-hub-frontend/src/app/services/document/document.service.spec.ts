import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DocumentService } from './document.service';
import { FileType } from '../../enums/file-type.enum';
import { ReserveDocumentPayload, ReserveDocumentResponse } from '../../models/document';

describe('DocumentService', () => {
  let service: DocumentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(DocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('reserveDocument POSTs metadata to /api/documents/reserve', () => {
    const payload: ReserveDocumentPayload = {
      building_id: '5312213',
      user_building_id: 'ub-1',
      name: 'Plan',
      is_public: false,
      file_type: FileType.PDF,
      file_original_name: 'plan.pdf'
    };
    let result: ReserveDocumentResponse | undefined;
    service.reserveDocument(payload).subscribe((r) => (result = r));

    const req = httpMock.expectOne('/api/documents/reserve');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    const response = {
      document: { id: 'doc-1', file_url: undefined } as never,
      upload: { endpoint: '/upload', token: 't', metadata: { document_id: 'doc-1', user_building_id: 'ub-1', filename: 'plan.pdf', filetype: 'pdf' } }
    };
    req.flush(response);
    expect(result).toEqual(response);
  });

  it('attachDocument POSTs stored_path to /api/documents/:id/attach', () => {
    const stored = '/mhub/documents/ub-1/doc-1/plan.pdf';
    let ok = false;
    service.attachDocument('doc-1', stored).subscribe((doc) => (ok = doc.id === 'doc-1'));

    const req = httpMock.expectOne('/api/documents/doc-1/attach');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ stored_path: stored });

    req.flush({ id: 'doc-1', building_id: '5312213', user_building_id: 'ub-1', owner_id: 'o', name: 'Plan', is_public: false });
    expect(ok).toBeTrue();
  });
});
