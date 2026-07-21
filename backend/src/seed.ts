import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./config/db";
import User from "./models/User";
import PartnerProfile from "./models/PartnerProfile";
import Product from "./models/Product";
import Address from "./models/Address";
import PaymentMethod from "./models/PaymentMethod";
import mongoose from "mongoose";

// Run with: npm run seed
// Wipes and repopulates the database with demo accounts + a few stores
// and products so the customer dashboard isn't empty on first run.
async function seed() {
  await connectDB();

  await Promise.all([
    User.deleteMany({}),
    PartnerProfile.deleteMany({}),
    Product.deleteMany({}),
    Address.deleteMany({}),
    PaymentMethod.deleteMany({}),
  ]);

  const admin = await User.create({
    name: "Admin",
    email: "admin@talabaty.com",
    password: "Admin123!",
    role: "admin",
    status: "active",
  });

  const customer = await User.create({
    name: "Hala Al Ali",
    email: "hala@example.com",
    password: "Passw0rd!",
    role: "customer",
    status: "active",
    phone: "+961 70 111 222",
    town: "Zahle",
  });

  await Address.create([
    {
      customerId: customer._id,
      label: "Home",
      fullAddress: "Main Street, Building 4, 2nd Floor",
      town: "Zahle",
      isDefault: true,
    },
    {
      customerId: customer._id,
      label: "Work",
      fullAddress: "Chtaura Industrial Road, Office 12",
      town: "Chtaura",
      isDefault: false,
    },
  ]);

  await PaymentMethod.create([
    {
      customerId: customer._id,
      type: "Cash",
      label: "Cash on delivery",
      isDefault: true,
    },
    {
      customerId: customer._id,
      type: "Whish",
      label: "My Whish",
      phoneNumber: "+961 70 111 222",
      isDefault: false,
    },
  ]);

  const partnerSeeds = [
    {
      name: "Beit El Mouneh Owner",
      email: "partner1@talabaty.com",
      storeName: "Beit El Mouneh",
      address: "Zahle, Main Street",
      phoneNumber: "+961 76 111 111",
      category: "Restaurant" as const,
      rating: 4.8,
      deliveryTime: "25-35 min",
      coverImageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Kafta%20shish%20kebab%20and%20grilled%20vegetables%20on%20salad%20-%20Cambridge%2C%20MA.jpg?width=600",
      products: [
        { title: "Kafta Plate", description: "Grilled with side salad", price: 8.5, category: "Restaurant", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Kafta%20shish%20kebab%20and%20grilled%20vegetables%20on%20salad%20-%20Cambridge%2C%20MA.jpg?width=400" },
        { title: "Veggie Pizza", description: "Fresh local vegetables", price: 10, category: "Restaurant", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Vegetarian%20Pizza.jpg?width=400" },
        { title: "Fattoush Salad", description: "Classic Lebanese salad", price: 5, category: "Restaurant", imageUrl: "https://loremflickr.com/400/300/salad" },
        { title: "Manakish Zaatar", description: "Fresh baked daily", price: 2.5, category: "Restaurant", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Manakish%20Za%27atar.jpg?width=400" },
      ],
    },
    {
      name: "Bekaa Fresh Market Owner",
      email: "partner2@talabaty.com",
      storeName: "Bekaa Fresh Market",
      address: "Chtaura, Market Road",
      phoneNumber: "+961 76 222 222",
      category: "Supermarket" as const,
      rating: 4.6,
      deliveryTime: "30-45 min",
      coverImageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Glass%20milk%20bottles.jpg?width=600",
      products: [
        { title: "Fresh Bananas", description: "1 kg", price: 1.2, category: "Supermarket", imageUrl: "https://images.unsplash.com/photo-1757332050958-b797a022c910?w=400&q=80&fit=crop&auto=format" },
        { title: "Olive Oil", description: "Extra Virgin, 1L", price: 7.5, category: "Supermarket", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Bottle%20of%20olive%20oil.jpg?width=400" },
        { title: "Milk", description: "Full Cream, 1L", price: 1.1, category: "Supermarket", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Glass%20milk%20bottles.jpg?width=400" },
        { title: "Chicken Breast", description: "1 kg", price: 4.5, category: "Supermarket", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Raw%20chicken%20slices.jpg?width=400" },
        { title: "Tomatoes", description: "1 kg", price: 1.3, category: "Supermarket", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Tomatoes.jpg?width=400" },
      ],
    },
    {
      name: "PharmaCare Owner",
      email: "partner3@talabaty.com",
      storeName: "PharmaCare",
      address: "Chtaura, Clinic Street",
      phoneNumber: "+961 76 333 333",
      category: "Pharmacy" as const,
      rating: 4.7,
      deliveryTime: "20-30 min",
      coverImageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Paracetamol%20acetaminophen%20500%20mg%20pills.jpg?width=600",
      products: [
        { title: "Paracetamol 500mg", description: "Box of 20", price: 2.0, category: "Pharmacy", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Paracetamol%20acetaminophen%20500%20mg%20pills.jpg?width=400" },
        { title: "Vitamin C", description: "60 tablets", price: 6.0, category: "Pharmacy", imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Vitaminske%20tablete%20c.jpg?width=400" },
      ],
    },
  ];

  for (const p of partnerSeeds) {
    const owner = await User.create({
      name: p.name,
      email: p.email,
      password: "Partner123!",
      role: "partner",
      status: "active",
    });

    const profile = await PartnerProfile.create({
      userId: owner._id,
      storeName: p.storeName,
      address: p.address,
      phoneNumber: p.phoneNumber,
      category: p.category,
      rating: p.rating,
      deliveryTime: p.deliveryTime,
      coverImageUrl: p.coverImageUrl,
    });

    for (const prod of p.products) {
      await Product.create({ ...prod, partnerId: profile._id });
    }
  }

  console.log("Seed complete.\n");
  console.log("Log in as customer:");
  console.log("  email:    hala@example.com");
  console.log("  password: Passw0rd!\n");
  console.log("Log in as admin:");
  console.log("  email:    admin@talabaty.com");
  console.log("  password: Admin123!\n");
  console.log("Log in as a partner (Beit El Mouneh):");
  console.log("  email:    partner1@talabaty.com");
  console.log("  password: Partner123!\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
