import { TestBed } from '@angular/core/testing';

import { SupabaseSupplierService } from './supabase_supplier.service';

describe('SupabaseSupplierService', () => {
  let service: SupabaseSupplierService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupabaseSupplierService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
