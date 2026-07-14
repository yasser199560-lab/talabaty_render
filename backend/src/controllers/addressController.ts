import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Address from "../models/Address";

// GET /api/addresses — all of the logged-in customer's saved addresses
export const getMyAddresses = async (req: AuthRequest, res: Response) => {
  const addresses = await Address.find({ customerId: req.user!.id }).sort({ isDefault: -1, createdAt: -1 });
  res.json(addresses);
};

// POST /api/addresses — add a new address. The very first address a
// customer saves is automatically made their default.
export const addAddress = async (req: AuthRequest, res: Response) => {
  const { label, fullAddress, town, isDefault } = req.body;

  const existingCount = await Address.countDocuments({ customerId: req.user!.id });
  const shouldBeDefault = isDefault || existingCount === 0;

  if (shouldBeDefault) {
    await Address.updateMany({ customerId: req.user!.id }, { isDefault: false });
  }

  const address = await Address.create({
    customerId: req.user!.id,
    label,
    fullAddress,
    town,
    isDefault: shouldBeDefault,
  });

  res.status(201).json(address);
};

// PATCH /api/addresses/:id — edit an address's details
export const updateAddress = async (req: AuthRequest, res: Response) => {
  const { label, fullAddress, town } = req.body;

  const address = await Address.findOne({ _id: req.params.id, customerId: req.user!.id });
  if (!address) return res.status(404).json({ message: "Address not found" });

  if (label !== undefined) address.label = label;
  if (fullAddress !== undefined) address.fullAddress = fullAddress;
  if (town !== undefined) address.town = town;
  await address.save();

  res.json(address);
};

// PATCH /api/addresses/:id/default — mark this address as the default,
// unmarking any other address the customer had set as default
export const setDefaultAddress = async (req: AuthRequest, res: Response) => {
  const address = await Address.findOne({ _id: req.params.id, customerId: req.user!.id });
  if (!address) return res.status(404).json({ message: "Address not found" });

  await Address.updateMany({ customerId: req.user!.id }, { isDefault: false });
  address.isDefault = true;
  await address.save();

  res.json(address);
};

// DELETE /api/addresses/:id
export const deleteAddress = async (req: AuthRequest, res: Response) => {
  const address = await Address.findOneAndDelete({ _id: req.params.id, customerId: req.user!.id });
  if (!address) return res.status(404).json({ message: "Address not found" });

  // If the deleted address was the default, promote the next most recent one.
  if (address.isDefault) {
    const next = await Address.findOne({ customerId: req.user!.id }).sort({ createdAt: -1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }

  res.json({ message: "Address deleted" });
};
