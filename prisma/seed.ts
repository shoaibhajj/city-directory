// prisma/seed.ts
// Idempotent seed — safe to run multiple times.
// Uses upsert throughout: running it twice produces the same DB state.

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── 1. Geography: Syria → Damascus Countryside → Al Nabik ────────────────
  const syria = await prisma.country.upsert({
    where: { code: "SY" },
    update: {},
    create: {
      name: "Syria",
      nameAr: "سوريا",
      code: "SY",
    },
  });
  console.log(`  ✓ Country: ${syria.nameAr}`);

  const damascusCountryside = await prisma.region.upsert({
    where: {
      // Region has no unique constraint — use findFirst pattern instead
      id: "region_damascus_countryside",
    },
    update: {},
    create: {
      id: "region_damascus_countryside",
      name: "Damascus Countryside",
      nameAr: "ريف دمشق",
      countryId: syria.id,
    },
  });
  console.log(`  ✓ Region: ${damascusCountryside.nameAr}`);

  const alNabik = await prisma.city.upsert({
    where: { slug: "al-nabik" },
    update: {},
    create: {
      name: "Al Nabik",
      nameAr: "النبك",
      slug: "al-nabik",
      regionId: damascusCountryside.id,
      isActive: true,
    },
  });
  console.log(`  ✓ City: ${alNabik.nameAr} (slug: ${alNabik.slug})`);

  // ── 2. Categories (10 core categories) ───────────────────────────────────
  const categories = [
    {
      nameAr: "صيدليات",
      nameEn: "Pharmacies",
      slug: "pharmacies",
      icon: "pill",
      displayOrder: 1,
    },
    {
      nameAr: "عيادات",
      nameEn: "Clinics",
      slug: "clinics",
      icon: "stethoscope",
      displayOrder: 2,
    },
    {
      nameAr: "مطاعم",
      nameEn: "Restaurants",
      slug: "restaurants",
      icon: "utensils",
      displayOrder: 3,
    },
    {
      nameAr: "محلات بقالة",
      nameEn: "Groceries",
      slug: "groceries",
      icon: "shopping-basket",
      displayOrder: 4,
    },
    {
      nameAr: "ورش ميكانيك",
      nameEn: "Auto Repair",
      slug: "auto-repair",
      icon: "wrench",
      displayOrder: 5,
    },
    {
      nameAr: "مخابز",
      nameEn: "Bakeries",
      slug: "bakeries",
      icon: "wheat",
      displayOrder: 6,
    },
    {
      nameAr: "صالونات",
      nameEn: "Salons",
      slug: "salons",
      icon: "scissors",
      displayOrder: 7,
    },
    {
      nameAr: "محلات ملابس",
      nameEn: "Clothing",
      slug: "clothing",
      icon: "shirt",
      displayOrder: 8,
    },
    {
      nameAr: "أدوات بناء",
      nameEn: "Building Materials",
      slug: "building-materials",
      icon: "hard-hat",
      displayOrder: 9,
    },
    {
      nameAr: "خدمات متنوعة",
      nameEn: "General Services",
      slug: "general-services",
      icon: "briefcase",
      displayOrder: 10,
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { displayOrder: cat.displayOrder },
      create: {
        ...cat,
        isVisible: true,
      },
    });
  }
  console.log(`  ✓ ${categories.length} categories seeded`);

  // ── 3. Super Admin user ───────────────────────────────────────────────────
  const adminEmail = "admin@city-directory.local";
  const adminPasswordHash = await bcrypt.hash("Admin@123456", 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Super Admin",
      passwordHash: adminPasswordHash,
      role: Role.SUPER_ADMIN,
      emailVerified: new Date(), // Pre-verified — no email flow needed
    },
  });
  console.log(`  ✓ Super Admin: ${adminUser.email} (role: ${adminUser.role})`);

  // ── 4. Platform Settings ──────────────────────────────────────────────────
  const settings: Array<{ key: string; value: string; description: string }> = [
    {
      key: "max_photos",
      value: "10",
      description: "Maximum number of photos allowed per business listing",
    },
    {
      key: "max_videos",
      value: "3",
      description: "Maximum number of videos allowed per business listing",
    },
    {
      key: "max_listings_per_owner",
      value: "3",
      description:
        "Maximum number of listings a single business owner can create",
    },
    {
      key: "max_video_size_mb",
      value: "100",
      description: "Maximum video file size in megabytes",
    },
    {
      key: "max_video_duration_seconds",
      value: "300",
      description: "Maximum video duration in seconds (300 = 5 minutes)",
    },
    {
      key: "pdf_cache_ttl_seconds",
      value: "21600",
      description:
        "How long to cache generated PDF files in Redis (21600 = 6 hours)",
    },
    {
      key: "listing_rate_limit_per_day",
      value: "1",
      description:
        "Maximum number of new listings a user can create per 24-hour period",
    },
  ];

  for (const setting of settings) {
    await prisma.platformSetting.upsert({
      where: { key: setting.key },
      update: {}, // Never overwrite — admin may have changed these values
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
      },
    });
  }
  console.log(`  ✓ ${settings.length} platform settings seeded`);

  console.log("\n✅ Seed complete.");
  console.log("─".repeat(50));
  console.log(`Admin login: ${adminEmail}`);
  console.log("Admin password: Admin@123456");
  console.log("─".repeat(50));
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
