import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed database with sample NDBC buoy stations
 */
async function main() {
  console.log("🌊 Seeding buoy stations...");

  // Sample NDBC stations from different regions
  const stations = [
    {
      id: "44009", // Delaware Bay - 26 NM Southeast of Cape May, NJ
      name: "Delaware Bay",
      lat: 38.457,
      lon: -74.703,
      source: "NDBC",
      isActive: true,
    },
    {
      id: "44013", // Boston - 16 NM East of Boston, MA
      name: "Boston",
      lat: 42.346,
      lon: -70.651,
      source: "NDBC",
      isActive: true,
    },
    {
      id: "46022", // Eel River - 17 NM West Southwest of Eureka, CA
      name: "Eel River",
      lat: 40.713,
      lon: -124.52,
      source: "NDBC",
      isActive: true,
    },
    {
      id: "46050", // Stonewall Bank - 20 NM West of Newport, OR
      name: "Stonewall Bank",
      lat: 44.656,
      lon: -124.526,
      source: "NDBC",
      isActive: true,
    },
    {
      id: "42001", // Mid-Gulf - 170 NM South of Southwest Pass, LA
      name: "Mid-Gulf",
      lat: 25.897,
      lon: -89.668,
      source: "NDBC",
      isActive: true,
    },
  ];

  for (const station of stations) {
    const result = await prisma.station.upsert({
      where: { id: station.id },
      update: station,
      create: station,
    });
    console.log(`  ✅ ${result.id}: ${result.name}`);
  }

  console.log(`\n✅ Seeded ${stations.length} stations`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
