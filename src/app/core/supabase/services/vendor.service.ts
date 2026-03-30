import { Injectable } from '@angular/core';
import { CreateVendorInput, Vendor } from '../../models/vendor';
import { CreateVendorItemPackInput, VendorItemPack } from '../../models/vendor-item-pack';
import { VendorRepositoryService } from '../repositories/vendor-repository.service';
import { VendorItemPackRepositoryService } from '../repositories/vendor-item-pack-repository.service';

@Injectable({
  providedIn: 'root',
})
export class VendorService {
  constructor(
    private vendorRepository: VendorRepositoryService,
    private vendorItemPackRepository: VendorItemPackRepositoryService
  ) {}

  createVendor(payload: CreateVendorInput): Promise<Vendor> {
    return this.vendorRepository.createVendor(payload);
  }

  updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<Vendor> {
    return this.vendorRepository.updateVendor(vendorId, updates);
  }

  activateVendor(vendor: Vendor): Promise<Vendor> {
    return this.vendorRepository.updateVendor(vendor.vendor_id, { is_active: true });
  }

  deactivateVendor(vendor: Vendor): Promise<Vendor> {
    return this.vendorRepository.updateVendor(vendor.vendor_id, { is_active: false });
  }

  createVendorItemPack(payload: CreateVendorItemPackInput): Promise<VendorItemPack> {
    return this.vendorItemPackRepository.createVendorItemPack(payload);
  }

  updateVendorItemPack(packId: string, updates: Partial<VendorItemPack>): Promise<VendorItemPack> {
    return this.vendorItemPackRepository.updateVendorItemPack(packId, updates);
  }

  deleteVendorItemPack(packId: string): Promise<void> {
    return this.vendorItemPackRepository.deleteVendorItemPack(packId);
  }
}
